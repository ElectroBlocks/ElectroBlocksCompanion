import { app, BrowserWindow, Menu, dialog, shell } from "electron";
import { SerialPort } from "serialport";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;
let selectedPortPath = "";
let selectedFilePath = "";

// Create the main window and load the ElectroBlocks website
const createWindow = () => {
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

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  updatePortsMenu();
};

// Fetch available serial ports
const getAvailablePorts = async () => {
  try {
    const ports = await SerialPort.list();
    return ports.filter((port) => port.path !== "COM1"); // Exclude COM1
  } catch (error) {
    return [];
  }
};

// Update the application menu with available ports and file options
const updatePortsMenu = async () => {
  const availablePorts = await getAvailablePorts();

  const portsSubmenu = availablePorts.length
    ? availablePorts.map((port) => ({
        label: `${port.path} - ${port.manufacturer || "Unknown"}`,
        click: () => {
          if (!port.manufacturer || port.path === "COM1") {
            dialog.showErrorBox("Invalid Port", "⚠️ This is not a valid Arduino port. Please select another port.");
            return;
          }

          selectedPortPath = port.path;
          dialog.showMessageBox({
            type: "info",
            title: "Port Selected",
            message: `✔️ Selected port: ${port.path}`,
          });
        },
      }))
    : [{ label: "No Arduino ports detected", enabled: false }];

  portsSubmenu.push(
    { type: "separator" },
    {
      label: "Refresh Ports",
      click: updatePortsMenu,
    }
  );

  const menuTemplate = [
    {
      label: "Ports",
      submenu: portsSubmenu,
    },
    {
      label: "File",
      submenu: [
        {
          label: "Select File",
          click: async () => {
            const result = await dialog.showOpenDialog({
              properties: ["openFile"],
            });

            if (!result.canceled && result.filePaths.length > 0) {
              selectedFilePath = result.filePaths[0];
              dialog.showMessageBox({
                type: "info",
                title: "File Selected",
                message: `✔️ Selected file: ${path.basename(selectedFilePath)}`,
              });
            }
          },
        },
        {
          label: "Upload Code to Arduino",
          click: () => {
            if (!selectedPortPath) {
              dialog.showErrorBox("Error", "⚠️ Please select a valid Arduino port first.");
              return;
            }

            if (!selectedFilePath) {
              dialog.showErrorBox("Error", "⚠️ Please select a file first.");
              return;
            }

            const arduino = new SerialPort({
              path: selectedPortPath,
              baudRate: 9600,
            });

            fs.readFile(selectedFilePath, "utf-8", (err, data) => {
              if (err) {
                dialog.showErrorBox("Error", `Failed to read file: ${err.message}`);
                return;
              }

              arduino.write(data, (error) => {
                if (error) {
                  dialog.showErrorBox("Error", `Failed to send data: ${error.message}`);
                } else {
                  arduino.drain(() => {
                    dialog.showMessageBox({
                      type: "info",
                      title: "Success",
                      message: "✔️ File uploaded successfully to Arduino!",
                    });
                    arduino.close();
                  });
                }
              });
            });
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);
};

// Initialize the application
app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
