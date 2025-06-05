const { app, BrowserWindow, ipcMain } = require("electron");
const { spawn, exec } = require("child_process");
const path = require("node:path");

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require("electron-squirrel-startup")) {
  app.quit();
}

let dockerComposeProcess = null;
let fastApiProcess = null;

const createWindow = () => {
  // Create the browser window with fixed size
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    resizable: false, // Make window non-resizable
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Load the index.html of the app.
  mainWindow.loadFile(path.join(__dirname, "index.html"));

  // Start Docker Compose
  dockerComposeProcess = spawn(
    "docker-compose",
    ["-f", path.join(__dirname, "docker/docker-compose.yml"), "up"],
    {
      cwd: path.join(__dirname, "docker"),
    }
  );

  dockerComposeProcess.stdout.on("data", (data) => {
    console.log(`Docker Compose 输出: ${data}`);
    mainWindow.webContents.send("backend-log", `Docker Compose: ${data}`);
  });

  dockerComposeProcess.stderr.on("data", (data) => {
    console.error(`Docker Compose 错误: ${data}`);
    mainWindow.webContents.send("backend-log", `Docker Compose 错误: ${data}`);
  });

  dockerComposeProcess.on("close", (code) => {
    console.log(`Docker Compose 退出，退出码: ${code}`);
    mainWindow.webContents.send(
      "backend-log",
      `Docker Compose 退出，退出码: ${code}`
    );
  });

  // Delay starting FastAPI to ensure MySQL container is ready
  setTimeout(() => {
    fastApiProcess = spawn("python", ["-m", "app.main"], {
      cwd: path.join(__dirname, "backend"),
      env: { ...process.env, PYTHONPATH: path.join(__dirname, "backend") },
    });

    fastApiProcess.stdout.on("data", (data) => {
      console.log(`FastAPI 输出: ${data}`);
      mainWindow.webContents.send("backend-log", `FastAPI: ${data}`);
    });

    fastApiProcess.stderr.on("data", (data) => {
      console.error(`FastAPI 错误: ${data}`);
      mainWindow.webContents.send("backend-log", `FastAPI 错误: ${data}`);
    });

    fastApiProcess.on("close", (code) => {
      console.log(`FastAPI 退出，退出码: ${code}`);
      mainWindow.webContents.send(
        "backend-log",
        `FastAPI 退出，退出码: ${code}`
      );
    });
  }, 10000); // Wait 10 seconds to ensure MySQL starts
};

// IPC event: Handle window size switch (optional, kept for compatibility)
ipcMain.on("switch-to-bigger", () => {
  const mainWindow = BrowserWindow.getFocusedWindow();
  if (mainWindow) {
    mainWindow.setSize(1200, 800);
  }
});

// Create window when app is ready
app.whenReady().then(() => {
  createWindow();

  // macOS: Recreate window when clicking Dock icon
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Clean up all processes when all windows are closed
app.on("window-all-closed", () => {
  // Stop FastAPI process if running
  if (fastApiProcess) {
    fastApiProcess.kill();
    console.log("FastAPI process terminated");
  }

  // Stop Docker Compose
  exec(
    `docker-compose -f ${path.join(
      __dirname,
      "docker/docker-compose.yml"
    )} down`,
    { cwd: path.join(__dirname, "docker") },
    (err, stdout, stderr) => {
      if (err) {
        console.error(`停止 Docker Compose 失败: ${stderr}`);
      } else {
        console.log(`Docker Compose 已停止: ${stdout}`);
      }
      // Quit app (except on macOS)
      if (process.platform !== "darwin") {
        app.quit();
      }
    }
  );
});

// Ensure processes are killed when app is quitting
app.on("before-quit", () => {
  if (fastApiProcess) {
    fastApiProcess.kill();
    console.log("FastAPI process terminated before quit");
  }
  if (dockerComposeProcess) {
    dockerComposeProcess.kill();
    console.log("Docker Compose process terminated before quit");
  }
});
