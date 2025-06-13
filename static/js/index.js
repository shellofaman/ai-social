import { sendRequest, isLoggedIn, logout } from "./util.js"
import { button, inputText, statusBar, nav } from "./components.js"

const TESTING = false
function generatePrompts() {
  const gEvent = new CustomEvent("GeneratePrompts")
  window.dispatchEvent(gEvent)
}

class PromptSection {
  #promptsContainer
  prompts = []
  #nextId = 0
  #generatePromptsDisabled = false
  constructor(container) {
    this.#promptsContainer = container
    window.addEventListener("GeneratePrompts", this.#generatePrompts)
    window.addEventListener("AddPrompts", this.#addPrompts)
    window.addEventListener("RemovePrompt", this.#removePrompt)
    window.addEventListener("SavePrompt", this.#savePrompt)
    window.addEventListener("UpdateGenerateButton", this.#updateGenerateButton)
  }

  #generatePrompts = async (e) => {
    try {
      const data = await sendRequest("/api/prompts", { method: "POST" })
      window.dispatchEvent(new CustomEvent("AddPrompts", {
        detail: data.prompts
      }))
    } catch (error) {
      console.error(error)
    }
  }
  get nextId() {
    return this.#nextId
  }
  
  #addPrompts = (e) => {
    e.detail.forEach(p => {
      const prompt = new Prompt({ prompt: p, id: this.nextId })
      this.#nextId++
      this.prompts.push(prompt)
      this.#promptsContainer.appendChild(prompt.tRow)
    })
    window.dispatchEvent(new CustomEvent("UpdateGenerateButton"))
    if (TESTING) console.log(this)
  }
  #removePrompt = (e) => {
    const index = this.prompts.findIndex(p => p.id === e.detail)
    const prompt = this.prompts.splice(index, 1)[0]
    prompt.removeTableRow()
    window.dispatchEvent(new CustomEvent("UpdateGenerateButton"))
    if (TESTING) console.log(this)
  }
  #savePrompt = async (e) => {
    const prompt = this.prompts.find(p => p.id === e.detail)
    const data = new FormData()
    data.append("prompt", prompt.text)
    try {
      await sendRequest("/api/prompt", {
        method: "POST",
        body: data
      })
      prompt.toggleSaved()
    } catch (error) {
      console.error(error)
    } finally {
      window.dispatchEvent(new CustomEvent("UpdateGenerateButton"))
    }
  }
  #updateGenerateButton = (e) => {
    this.#generatePromptsDisabled = this.prompts.some(p => !p.saved)
    document.getElementById("generate_prompts").disabled = this.#generatePromptsDisabled
  }
}

class Prompt {
  #text
  #tRow
  #saveButton
  #textInput
  #saved = false
  #id

  constructor(object) {
    this.#text = object.prompt
    this.#id = object.id
    window.addEventListener(`UpdatePrompt[${this.#id}]`, this.#updatePromptHandler)
    this.#createElement()
  }

  /**
   * @param {string} value
   */
  set text(value) {
    this.#text = value
  }
  get text() {
    return this.#text
  }
  /**
   * @param {number} value
   */
  set id(value) {
    this.#id = value
  }
  get id() {
    return this.#id
  }
  get saved() {
    return this.#saved
  }
  toggleSaved = () => {
    this.#saved = !this.#saved
    this.#saveButton.disabled = this.#saved
    this.#textInput.disabled = this.#saved
  }
  #createElement = () => { 
    const tr = document.createElement("tr")
    const tdText = document.createElement("td")
    this.#textInput = inputText(this.#text, (e) => {
      this.#text = e.target.value
    })
    tdText.appendChild(this.#textInput)
    const tdActions = document.createElement("td")
    this.#saveButton = button(() => {
      window.dispatchEvent(new CustomEvent("SavePrompt", { detail: this.#id }))
    }, "Save")
    const remove = button(() => {
      window.dispatchEvent(new CustomEvent("RemovePrompt", { detail: this.#id }))
    }, "Remove")
    tdActions.appendChild(this.#saveButton)
    tdActions.appendChild(remove)
    tr.appendChild(tdText)
    tr.appendChild(tdActions)
    this.#tRow = tr
  }
  removeTableRow = () => {
    this.#tRow.remove()
  }
  get tRow() {
    return this.#tRow
  }
  #updatePromptHandler = ({ detail }) => {
    console.log(detail)
  }
}

function main() {
  const loginButton = document.getElementById("login_button")
  isLoggedIn().then(r => {
    if (r) {
      loginButton.innerText = "Logout"
      loginButton.onclick = logout
      statusBar()
      nav(["prompts", "images", "generate_prompts"])
      document.getElementById("generate_prompts").addEventListener("click", generatePrompts)
      new PromptSection(document.getElementById("new_prompts_body"))
    } else {
      loginButton.innerText = "Login"
      loginButton.onclick = () => {
        window.location.href = "/login"
      }
    }
  })
}
main()