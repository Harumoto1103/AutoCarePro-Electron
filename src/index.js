const { app, BrowserWindow, ipcMain } = require("electron");
const { spawn, exec } = require("child_process");
const path = require("node:path");

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require("electron-squirrel-startup")) {
  app.quit();
}

let dockerComposeProcess = null;
let fastApiProcess = null;
let mainWindow = null;
let loadingWindow = null;

const createLoadingWindow = () => {
  loadingWindow = new BrowserWindow({
    width: 400,
    height: 300,
    resizable: false,
    frame: false,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  loadingWindow.loadFile(path.join(__dirname, "loading.html"));
  loadingWindow.once("ready-to-show", () => {
    loadingWindow.show();
  });
};

const createMainWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    resizable: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.loadFile(path.join(__dirname, "index.html"));
  mainWindow.once("ready-to-show", () => {
    if (loadingWindow) {
      loadingWindow.close();
      loadingWindow = null;
    }
    mainWindow.show();
  });

  // Treat window close as app quit
  mainWindow.on("closed", () => {
    mainWindow = null;
    app.quit();
  });
};

// Check if container exists
const checkContainerExists = (containerName) => {
  return new Promise((resolve) => {
    exec(`docker ps -a -q -f name=${containerName}`, (err, stdout) => {
      if (err) {
        console.error(`检查容器失败: ${err.message}`);
        resolve(false);
      }
      resolve(!!stdout.trim());
    });
  });
};

// Start Docker Compose
const startDockerCompose = () => {
  return new Promise((resolve) => {
    const dockerComposeFile = path.join(__dirname, "docker/docker-compose.yml");
    const containerName = "mysqldb"; // Matches your service name

    checkContainerExists(containerName).then((exists) => {
      const args = exists
        ? ["-f", dockerComposeFile, "start"]
        : ["-f", dockerComposeFile, "up", "-d"];

      dockerComposeProcess = spawn("docker-compose", args, {
        cwd: path.join(__dirname, "docker"),
      });

      dockerComposeProcess.stdout.on("data", (data) => {
        const output = data.toString();
        console.log(`Docker Compose 输出: ${output}`);
        if (loadingWindow) {
          loadingWindow.webContents.send(
            "backend-log",
            `Docker Compose: ${output}`
          );
        }
        // Resolve immediately to allow FastAPI to proceed
        resolve();
      });

      dockerComposeProcess.stderr.on("data", (data) => {
        console.error(`Docker Compose 错误: ${data}`);
        if (loadingWindow) {
          loadingWindow.webContents.send(
            "backend-log",
            `Docker Compose 错误: ${data}`
          );
        }
        if (data.indexOf("Started") != -1 || data.indexOf("Running") != -1)
          resolve();
      });

      dockerComposeProcess.on("error", (err) => {
        console.error(`Docker Compose 启动失败: ${err.message}`);
        resolve(); // Resolve to allow FastAPI to proceed despite Docker errors
      });
    });
  });
};

// Start FastAPI
const startFastAPI = () => {
  return new Promise((resolve, reject) => {
    fastApiProcess = spawn("python", ["-m", "app.main"], {
      cwd: path.join(__dirname, "backend"),
      env: { ...process.env, PYTHONPATH: path.join(__dirname, "backend") },
    });

    const checkReady = (data) => {
      const output = data.toString();
      console.log(`FastAPI 输出: ${output}`);
      if (loadingWindow) {
        loadingWindow.webContents.send("backend-log", `FastAPI: ${output}`);
      }
      console.log(output.indexOf("Application startup complete"));
      if (
        output.indexOf("Application startup complete") != -1 ||
        output.indexOf("Address already in use") != -1
      ) {
        console.log("Calling resolve();");
        resolve();
      }
    };

    fastApiProcess.stdout.on("data", checkReady);
    fastApiProcess.stderr.on("data", checkReady);

    fastApiProcess.on("error", (err) => {
      console.error(`FastAPI 启动失败: ${err.message}`);
      reject(err);
    });
  });
};

// Start backend and monitor readiness
const startBackend = async () => {
  await Promise.all([startDockerCompose(), startFastAPI()]);
};

// Clean up backend processes
const cleanupBackend = async () => {
  if (fastApiProcess) {
    fastApiProcess.kill("SIGTERM");
    await new Promise((resolve) => {
      fastApiProcess.on("close", () => {
        console.log("FastAPI process terminated");
        resolve();
      });
    });
    fastApiProcess = null;
  }

  if (dockerComposeProcess) {
    return new Promise((resolve) => {
      exec(
        `docker-compose -f ${path.join(
          __dirname,
          "docker/docker-compose.yml"
        )} down`,
        { cwd: path.join(__dirname, "docker") },
        (err, stdout, stderr) => {
          if (err) {
            console.error(`停止 Docker Compose 失败: ${stderr}`);
            resolve(); // Continue cleanup despite error
          } else {
            console.log(`Docker Compose 已停止: ${stdout}`);
            resolve();
          }
        }
      );
      dockerComposeProcess.kill("SIGTERM");
    });
  }
};

// IPC event: Handle window size switch (kept for compatibility)
ipcMain.on("switch-to-bigger", () => {
  if (mainWindow) {
    mainWindow.setSize(1200, 800);
  }
});

// App initialization
app.whenReady().then(async () => {
  createLoadingWindow();
  try {
    await startBackend();
    createMainWindow();
  } catch (err) {
    console.error("Backend startup failed:", err);
    if (loadingWindow) {
      loadingWindow.webContents.send(
        "backend-log",
        `Backend startup failed: ${err.message}`
      );
    }
    await cleanupBackend();
    app.quit();
  }
});

// Handle app quit
app.on("will-quit", async (event) => {
  event.preventDefault(); // Prevent default quit to handle cleanup
  await cleanupBackend();
  app.exit(); // Force exit after cleanup
});

// macOS: Recreate window when clicking Dock icon
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0 && !loadingWindow) {
    createLoadingWindow();
    startBackend()
      .then(() => createMainWindow())
      .catch(async (err) => {
        console.error("Backend startup failed:", err);
        await cleanupBackend();
        app.quit();
      });
  }
});
