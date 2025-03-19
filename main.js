import { app, BrowserWindow, Menu, dialog } from "electron";
import { SerialPort } from "serialport";
import fs from "fs";

let mainWindow;
let selectedPortPath = "";
let selectedFilePath = "";

// Get Available Ports
const getAvailablePorts = async () => {
    try {
        return await SerialPort.list();
    } catch (error) {
        return [];
    }
};

const refreshPorts = async () => {
    const availablePorts = await getAvailablePorts();
    const portMenu = availablePorts.length
        ? availablePorts.map((port) => ({
            label: port.path,
            click: () => {
                selectedPortPath = port.path;
                dialog.showMessageBox({
                    type: "info",
                    title: "Port Connected",
                    message: `✅ ${port.path} is connected`
                });
            }
        }))
        : [{ label: "No ports available" }];

    const menuTemplate = [
        {
            label: "Ports",
            submenu: [
                ...portMenu,
                { type: "separator" },
                { label: "Refresh Ports", click: refreshPorts }
            ]
        },
        {
            label: "File",
            submenu: [
                {
                    label: "Upload Python Code",
                    click: async () => {
                        const result = await dialog.showOpenDialog({
                            properties: ["openFile"],
                            filters: [{ name: "Python Files", extensions: ["py"] }]
                        });

                        if (!result.canceled && result.filePaths.length > 0) {
                            if (!result.filePaths[0].endsWith(".py")) {
                                dialog.showErrorBox("Error", "Please select a valid .py file.");
                                return;
                            }
                            selectedFilePath = result.filePaths[0];
                            dialog.showMessageBox({
                                type: "info",
                                title: "File Uploaded",
                                message: "✔️ File uploaded successfully to Electron!"
                            });
                        }
                    }
                },
                {
                    label: "Upload Code to Arduino",
                    click: sendPythonCodeToArduino
                }
            ]
        }
    ];

    const menu = Menu.buildFromTemplate(menuTemplate);
    Menu.setApplicationMenu(menu);
};

const sendPythonCodeToArduino = () => {
    if (!selectedPortPath) {
        dialog.showErrorBox("Error", "Please select a port first.");
        return;
    }

    if (!selectedFilePath) {
        dialog.showErrorBox("Error", "Please upload a Python file first.");
        return;
    }

    const arduino = new SerialPort({ path: selectedPortPath, baudRate: 9600 });

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
                        message: "✅ Python code uploaded successfully to Arduino!"
                    });
                    arduino.close();  // Port Management Enhancement: Close port after data transmission
                });
            }
        });
    });
};

app.whenReady().then(async () => {
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    await refreshPorts();  // Load ports initially
});
