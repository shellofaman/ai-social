import { sendRequest } from "./util.js"
import { button } from "./components.js"

function navigate(path) {
  window.location.href = path
}


class PromptsList {
  #promptsList = []
  #promptsElement

  constructor() {
    this.#promptsElement = document.getElementById("prompts_body")
    this.loadPrompts()
  }

  async loadPrompts() {
    try {
      const prompts = await sendRequest("/api/prompts")
      this.#promptsList = prompts
      this.#promptsList.forEach(p => {
        const prompt = new Prompt(p)
        this.#promptsElement.appendChild(prompt.tRow)
      })
    } catch (error) {
      console.error(error)
    }
  }
}

class Prompt {
  #id
  #text
  #tRow

  constructor(object) {
    this.#id = object.id
    this.#text = object.text
    this.createTableRow()
  }
  get tRow() {
    return this.#tRow
  }
  createTableRow = () => {
    const tRow = document.createElement("tr")
    const idCell = document.createElement("td")
    const textCell = document.createElement("td")
    const actionsCell = document.createElement("td")
    const idText = document.createElement("p")
    const textText = document.createElement("p")
    const manageButton = button(() => navigate(`/prompt/${this.#id}`), "Manage Prompt")
    idText.textContent = this.#id
    textText.textContent = this.#text
    idCell.appendChild(idText)
    textCell.appendChild(textText)
    actionsCell.appendChild(manageButton)
    tRow.appendChild(idCell)
    tRow.appendChild(textCell)
    tRow.appendChild(actionsCell)
    this.#tRow = tRow
  }
}

function main() {
  new PromptsList()
}
main()