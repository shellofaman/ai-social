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