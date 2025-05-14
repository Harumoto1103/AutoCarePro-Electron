// const create_alert = (title, content, button, callback) => {
//   return `<div
//     style="
//       display: flex;
//       justify-content: center;
//       align-items: center;
//       width: 100vw;
//       height: 100vh;
//       z-index: 999;
//       background: rgba(255, 255, 255, 0.75);
//       position: fixed;
//       top: 0;
//     "
//     id="alert"
//   >
//     <div
//       style="
//         width: 60%;
//         min-height: 200px;
//         box-shadow: 3px 4px 10px rgba(0, 0, 0, 0.2);
//         border: 1px solid black;
//         border-radius: 10px;
//         display: flex;
//         flex-direction: column;
//         justify-content: center;
//         align-items: center;
//       "
//     >
//       <div
//         style="
//           text-align: left;
//           padding: 10px 10px 10px 20px;
//           width: calc(100% - 30px);
//           color: black;
//           background: rgba(255, 255, 255, 0.8);
//           border-top-left-radius: 10px;
//           border-top-right-radius: 10px;
//           border-bottom: 0.5px solid black;
//         "
//       >
//         ${title}
//       </div>
//       <div
//         style="
//           text-align: left;
//           padding: 10px 20px 10px 20px;
//           background: rgba(0, 0, 0, 0.2);
//           flex-grow: 1;
//           width: calc(100% - 40px);
//         "
//       >
//         ${content}
//       </div>
//       <div
//         style="
//           width: 100%;
//           display: flex;
//           justify-content: end;
//           align-items: center;
//           padding: 10px 0px 10px 0px;
//           background: rgba(0, 0, 0, 0.2);
//           border-bottom-left-radius: 10px;
//           border-bottom-right-radius: 10px;
//         "
//       >
//         <div
//           style="
//             padding: 5px 10px;
//             color: white;
//             background: rgba(0, 0, 0, 0.8);
//             display: flex;
//             justify-content: center;
//             align-items: center;
//             width: 100px;
//             height: 30px;
//             border-radius: 10px;
//             margin-right: 20px;
//           "
//           onclick="document.querySelector('#alert').remove(); (${callback})()"
//         >
//           ${button}
//         </div>
//       </div>
//     </div>
//   </div>`;
// };

// alert = (title, content, button, callback) => {
//   const alert = create_alert(title, content, button, callback);
//   document.body.innerHTML += `${alert}`;
// };

/**
 * Show a modal dialog.
 * @param {string} title
 * @param {string|Node} content
 * @param {string} buttonText
 * @returns {Promise<void>}
 */
const alert_async = ({ title = "", content = "", buttonText = "OK" } = {}) => {
  return new Promise((resolve) => {
    // backdrop
    const backdrop = document.createElement("div");
    backdrop.classList.add("modal-backdrop");

    // panel
    const panel = document.createElement("div");
    panel.classList.add("modal-panel");

    // header
    const header = document.createElement("div");
    header.classList.add("modal-header");
    header.textContent = title;

    // body
    const body = document.createElement("div");
    body.classList.add("modal-body");
    if (typeof content === "string") {
      body.innerHTML = content;
    } else {
      body.appendChild(content);
    }

    // footer & button
    const footer = document.createElement("div");
    footer.classList.add("modal-footer");
    const btn = document.createElement("button");
    btn.classList.add("modal-btn");
    btn.textContent = buttonText;
    footer.appendChild(btn);

    // assemble
    panel.append(header, body, footer);
    backdrop.appendChild(panel);
    document.body.appendChild(backdrop);

    // force reflow → allow transition
    requestAnimationFrame(() => backdrop.classList.add("open"));

    // click handler
    btn.addEventListener("click", () => {
      backdrop.classList.remove("open");
      backdrop.addEventListener(
        "transitionend",
        () => {
          backdrop.remove();
          resolve();
        },
        { once: true }
      );
    });
  });
};

const alert = (title, content, buttonText, callback) => {
  (async () => {
    await alert_async({ title, content, buttonText });
    callback();
  })();
};
