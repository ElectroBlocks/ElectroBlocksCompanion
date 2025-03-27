import asyncio
import websockets
import serial
import serial.tools.list_ports

active_connections = set()
arduino = None

# Function to find Arduino port dynamically
def find_arduino():
    for port in serial.tools.list_ports.comports():
        if "Arduino" in port.description:
            return port.device
    return None

# Function to connect/reconnect to Arduino
def connect_arduino():
    global arduino
    port = find_arduino()
    if port:
        try:
            arduino = serial.Serial(port, 9600, timeout=1)
            print(f"✅ Connected to Arduino on {port}")
        except serial.SerialException as e:
            print(f"❌ Error connecting to Arduino: {e}")
            arduino = None
    else:
        print("⚠️ No Arduino detected.")

# Function to handle WebSocket communication
async def handle_client(websocket, path):
    active_connections.add(websocket)
    try:
        async for message in websocket:
            print(f"📩 Received: {message}")

            if message == "LIST_PORTS":
                ports = [p.device for p in serial.tools.list_ports.comports()]
                await websocket.send(str(ports))

            elif message == "CONNECT_ARDUINO":
                connect_arduino()
                if arduino:
                    await websocket.send("✅ Arduino connected!")
                else:
                    await websocket.send("❌ Failed to connect to Arduino!")

            elif message == "DISCONNECT_ARDUINO":
                global arduino
                if arduino:
                    arduino.close()
                    arduino = None
                    await websocket.send("🔌 Arduino Disconnected")
                else:
                    await websocket.send("⚠️ No active connection")

            elif message.startswith("UPLOAD_CODE:"):
                if arduino:
                    code = message.replace("UPLOAD_CODE:", "").strip()
                    try:
                        arduino.write(code.encode() + b'\n')
                        response = arduino.readline().decode().strip()
                        await websocket.send(f"Arduino Response: {response}")
                    except serial.SerialException:
                        await websocket.send("❌ Error: Arduino disconnected. Reconnecting...")
                        connect_arduino()
                else:
                    await websocket.send("❌ Error: No Arduino connected.")

    except websockets.exceptions.ConnectionClosed:
        print("❌ WebSocket Connection Closed")
    finally:
        active_connections.remove(websocket)

# Start WebSocket server
async def main():
    connect_arduino()  # Try connecting at startup
    server = await websockets.serve(handle_client, "localhost", 8765)

    try:
        print("🚀 WebSocket Server Running at ws://localhost:8765")
        await asyncio.Future()  # Keep running
    except asyncio.CancelledError:
        pass
    finally:
        for ws in active_connections:
            await ws.close()
        server.close()
        await server.wait_closed()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("🛑 Server stopped manually")
