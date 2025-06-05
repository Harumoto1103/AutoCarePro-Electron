const { app, BrowserWindow, ipcMain } = require("electron");
const { spawn, exec } = require("child_process");
const path = require("node:path");

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require("electron-squirrel-startup")) {
  app.quit();
}

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Load the index.html of the app.
  mainWindow.loadFile(path.join(__dirname, "index.html"));

  // Open the DevTools (optional, uncomment for debugging).
  // mainWindow.webContents.openDevTools();

  // 启动 Docker Compose
  const dockerComposeUp = spawn(
    "docker-compose",
    ["-f", path.join(__dirname, "docker/docker-compose.yml"), "up"],
    {
      cwd: path.join(__dirname, "docker"),
    }
  );

  dockerComposeUp.stdout.on("data", (data) => {
    console.log(`Docker Compose 输出: ${data}`);
    // 可选：通过 IPC 将日志发送到前端
    mainWindow.webContents.send("backend-log", `Docker Compose: ${data}`);
  });

  dockerComposeUp.stderr.on("data", (data) => {
    console.error(`Docker Compose 错误: ${data}`);
    mainWindow.webContents.send("backend-log", `Docker Compose 错误: ${data}`);
  });

  dockerComposeUp.on("close", (code) => {
    console.log(`Docker Compose 退出，退出码: ${code}`);
    mainWindow.webContents.send(
      "backend-log",
      `Docker Compose 退出，退出码: ${code}`
    );
  });

  // 延迟启动 FastAPI，确保 MySQL 容器准备好
  setTimeout(() => {
    const fastApiProcess = spawn("python", ["-m", "app.main"], {
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
  }, 10000); // 等待 10 秒，确保 MySQL 启动
};

// IPC 事件：切换窗口大小
ipcMain.on("switch-to-bigger", () => {
  const mainWindow = BrowserWindow.getFocusedWindow();
  if (mainWindow) {
    mainWindow.setSize(1200, 800);
  }
});

// 应用初始化完成时创建窗口
app.whenReady().then(() => {
  createWindow();

  // macOS 下点击 Dock 图标重新创建窗口
  app.on("activate", () => {
    if (BrowserWindow.getAll窗户().length === 0) {
      createWindow();
    }
  });
});

// 所有窗口关闭时，清理 Docker 容器并退出（macOS 除外）
app.on("window-all-closed", () => {
  // 停止 Docker Compose
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
      if (process.platform !== "darwin") {
        app.quit();
      }
    }
  );
});
