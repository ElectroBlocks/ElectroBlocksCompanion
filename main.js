import { app, BrowserWindow, Tray, Menu, dialog, shell } from "electron";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { SerialPort } from "serialport";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;
let tray;
const startExpressServer = () => {
  const expressApp = express();
  const PORT = 4000;

  expressApp.get("/ports", async (req, res) => {
    try {
      const ports = await SerialPort.list();
      res.json(
        ports.map((port) => ({
          path: port.path,
          manufacturer: port.manufacturer || "Unknown",
          vendorId: port.vendorId || "N/A",
          productId: port.productId || "N/A",
          serialNumber: port.serialNumber || "N/A",
        }))
      );
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  expressApp.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}/ports`);
  });
};
const getAvailablePorts = async () => {
  try {
    return await SerialPort.list();
  } catch (error) {
    return [];
  }
};
const updatePortsMenu = async () => {
  const availablePorts = await getAvailablePorts();

  const portsSubmenu = availablePorts.length
    ? availablePorts.map((port) => ({
        label: port.path,
        click: () => {
          dialog.showMessageBox({
            type: "info",
            title: "Port Info",
            message: JSON.stringify(
              {
                path: port.path,
                manufacturer: port.manufacturer || "Unknown",
                vendorId: port.vendorId || "N/A",
                productId: port.productId || "N/A",
                serialNumber: port.serialNumber || "N/A",
              },
              null,
              2
            ),
          });
        },
      }))
    : [{ label: "No ports available", enabled: false }];

  portsSubmenu.push({ type: "separator" });
  portsSubmenu.push({
    label: "Refresh Ports",
    click: async () => {
      await updatePortsMenu();
    },
  });
  portsSubmenu.push({
    label: "View Ports Online",
    click: () => shell.openExternal("http://localhost:4000/ports"),
  });

  const menuTemplate = [
    {
      label: "Ports",
      submenu: portsSubmenu,
    },
  ];
  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);
};
const createWindow = async () => {
  if (mainWindow) {
    mainWindow.show();
    return;
  }
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
    },
  });
  mainWindow.loadURL("https://electroblocks.org");

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
  await updatePortsMenu();
};
app.whenReady().then(() => {
  const iconPath = path.join(__dirname, "icon.png");
  tray = new Tray(iconPath);

  const contextMenu = Menu.buildFromTemplate([
    { label: "Open ElectroBlocks", click: createWindow },
    { type: "separator" },
    { label: "Quit", click: () => app.quit() },
  ]);

  tray.setToolTip("ElectroBlocks Tray App");
  tray.setContextMenu(contextMenu);
  tray.on("click", createWindow);
  startExpressServer();
  updatePortsMenu();
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
