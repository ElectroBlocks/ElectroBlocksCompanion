import asyncio
import websockets
import serial
import serial.tools.list_ports

active_connections = set()

def find_arduino():
    for port in serial.tools.list_ports.comports():
        if "Arduino" in port.description:
            return port.device
    return None

arduino_port = find_arduino()
arduino = serial.Serial(arduino_port, 9600, timeout=1) if arduino_port else None

def reconnect_arduino():
    global arduino
    arduino_port = find_arduino()
    if arduino_port:
        arduino = serial.Serial(arduino_port, 9600, timeout=1)

async def handle_client(websocket, path):
    active_connections.add(websocket)
    try:
        async for message in websocket:
            if arduino:
                try:
                    arduino.write(message.encode() + b'\n')
                    response = arduino.readline().decode().strip()
                    await websocket.send(f"Arduino Response: {response}")
                except serial.SerialException:
                    print("Error: Arduino disconnected. Reconnecting...")
                    reconnect_arduino()
            else:
                await websocket.send("Error: Arduino not connected.")
    except websockets.exceptions.ConnectionClosed:
        pass
    finally:
        active_connections.remove(websocket)

async def main():
    server = await websockets.serve(handle_client, "localhost", 8765)

    try:
        await asyncio.Future()
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
        pass
