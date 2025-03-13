import { app, BrowserWindow, Menu, dialog, shell } from "electron";
import express from "express";
import { SerialPort } from "serialport";
let mainWindow;
// Start Express Server Inside Electron
const startExpressServer = () => {
  const expressApp = express();
  const PORT = 4000;

  expressApp.get("/ports", async (req, res) => {
    try {
      const ports = await SerialPort.list();
      res.json(ports.map((port) => ({
        path: port.path,
        manufacturer: port.manufacturer || "Unknown",
        vendorId: port.vendorId || "N/A",
        productId: port.productId || "N/A",
        serialNumber: port.serialNumber || "N/A"
      })));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  expressApp.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}/ports`);
  });
};

// Function to Get Available Ports
const getAvailablePorts = async () => {
  try {
    const ports = await SerialPort.list();
    return ports;
  } catch (error) {
    return [];
  }
};

app.whenReady().then(async () => {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: false,
    },
  });

  const availablePorts = await getAvailablePorts();

  const menuTemplate = [
    {
      label: "Ports",
      submenu: [
        ...(
          availablePorts.length
            ? availablePorts.map((port) => ({
                label: port.path,
                click: () => {
                  dialog.showMessageBox({
                    type: "info",
                    title: "Port Info",
                    message: JSON.stringify({
                      path: port.path,
                      manufacturer: port.manufacturer || "Unknown",
                      vendorId: port.vendorId || "N/A",
                      productId: port.productId || "N/A",
                      serialNumber: port.serialNumber || "N/A"
                    }, null, 2),
                  });
                },
              }))
            : [{ label: "No ports available" }]
        ),
        { type: "separator" }, 
        {
          label: "View Ports Online",
          click: () => {
            shell.openExternal("http://localhost:4000/ports");
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);
  startExpressServer();
});
