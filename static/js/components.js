import { getStatus, sendRequest } from "./util.js"

export function button(action, text) {
  const button = document.createElement("button")
  button.innerText = text
  button.onclick = action
  return button
}

export function inputText(defaultText, inputMethod) {
  const input = document.createElement("input")
  input.value = defaultText
  input.oninput = inputMethod
  return input
}

export async function statusBar() {
  const statusBar = document.getElementById("status_bar")
  const testingButton = document.createElement("button")
  testingButton.onclick = () => {
    sendRequest("/api/status", { method: "PUT" }).then(d => statusBar.innerText = `TESTING MODE: ${d.testing}`)
  }
  getStatus().then(d => {
    const p = document.createElement("p")
    p.innerText = `TESTING MODE: ${d.testing}`
    statusBar.insertBefore(p, statusBar.firstChild)
    if (d.testing) {
      testingButton.innerText = "Disable Testing Mode"
    } else {
      testingButton.innerText = "Enable Testing Mode"
    }
    statusBar.appendChild(testingButton)
  })
}

export function nav(navItems) {
  const items = {
    "prompts": navItem("/prompts", "Prompts", null, true, ["rounded-full"]),
    "images": navItem("/images", "Images", null, true, ["rounded-full"]),
    "generate_prompts": navItem("/generate_prompts", "Generate Prompts", null, false, ["rounded-full"], "generate_prompts"),
    "home": navItem("/", "Home", null, true, ["rounded-full"])
  }
  const navElem = document.getElementById("nav")
  navItems.forEach(item => {
    navElem.appendChild(items[item])
  })
}

function navItem(url, text, action = null, anchor = true, classList = [], id = null) {
  const button = document.createElement("button")
  if (anchor) {
    button.innerHTML = `<a href="${url}">${text}</a>`
  } else {
    button.innerText = text
    button.onclick = action
  }
  if (id) button.id = id
  if (classList.length > 0) classList.forEach(c => button.classList.add(c))
  return button
}
