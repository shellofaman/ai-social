async function loadImages(id) {
  window.dispatchEvent(new CustomEvent("LoadImages", { detail: { id } }))
}
async function changePrompt(value) {
  window.dispatchEvent(new CustomEvent("ChangePrompt", { detail: { text: value }}))  
}
async function savePrompt() {
  window.dispatchEvent(new CustomEvent("SavePrompt"))
}

function button(action, text) {
  const button = document.createElement("button")
  button.innerText = text
  button.onclick = action
  return button
}

class Prompt {
  #originalPrompt
  #prompt
  #saveButton
  #id
  #imageSection

  constructor() {
    const promptElem = document.getElementById("prompt")
    this.#originalPrompt = promptElem.value
    this.#prompt = promptElem.value
    const saveElem = document.getElementById("save_button")
    this.#saveButton = saveElem
    this.#id = saveElem.dataset.id
    this.#imageSection = new ImageSection(document.getElementById("image_container"), this.#id)
    window.addEventListener("ChangePrompt", this.#changePrompt)
    window.addEventListener("SavePrompt", this.#savePrompt)
  }

  #changePrompt = ({ detail }) => {
    this.#prompt = detail.text
    this.#saveButton.disabled = this.#prompt === this.#originalPrompt
  }

  #savePrompt = async () => {
    if (this.#saveButton.disabled) return
    this.#saveButton.disabled = true
    const formData = new FormData()
    formData.append("text", this.#prompt)
    const result = await fetch(`http://127.0.0.1:5000/prompt/${this.#id}`, {
      method: "PUT",
      body: formData
    })
    if (result.ok) {
      const data = await result.json()
      this.#originalPrompt = data.prompt.text
      this.#prompt = data.prompt.text
    } else {
      console.error(result)
      this.#saveButton.disabled = false
    }
  }
}

class ImageSection {
  #images = []
  #container
  #promptId

  constructor(element, promptId) {
    this.#container = element
    this.#promptId = promptId
    window.addEventListener("LoadImages", this.#loadImages)
    window.addEventListener("DeleteImage", this.#deleteImage)
  }

  #loadImages = async () => {
    const result = await fetch(`http://127.0.0.1:5000/prompt/${this.#promptId}/images`)
    if (result.ok) {
      const data = await result.json()
      const newImages = data.images.filter(i => !this.#images.includes(i.id))
      const imgs = newImages.map(img => new ImageElem(img.id, img.url))
      this.#images.push(...imgs)
      this.#images.forEach(img => this.#container.appendChild(img.img))
    } else {
      console.error(result)
    }
  }

  #deleteImage = async ({ detail }) => {
    const result = await fetch(`http://127.0.0.1:5000/prompt/${this.#promptId}/image/${detail.id}`, {
      method: "DELETE",
    })
    if (result.ok) {
      const imgIndex = this.#images.findIndex(img => img.id === detail.id)
      const img = this.#images.splice(imgIndex, 1)[0]
      img.deleteImage()
    } else {
      console.error(result)
    }
  }

}

class ImageElem {
  #url
  #width
  #height
  #imgContainer
  #id

  constructor(id, url) {
    this.#id = id
    this.#url = url
    this.#height = 1024 / 4
    this.#width = 1024 / 4
    this.#renderImage()
  }

  #renderImage = () => {
    this.#imgContainer = document.createElement("div")
    const img = document.createElement("img")
    img.src = this.#url.includes("http") ? this.#url : `http://127.0.0.1:5000/static/assets/images/${this.#url}`
    img.width = this.#width
    img.height = this.#height
    const deleteBtn = button(() => {
      window.dispatchEvent(new CustomEvent("DeleteImage", { detail: { id: this.#id }}))
    }, "Delete")
    this.#imgContainer.appendChild(img)
    this.#imgContainer.appendChild(deleteBtn)
  }
  deleteImage = () => {
    this.#imgContainer.remove()
  }
  get img() {
    return this.#imgContainer
  }
  get id() {
    return this.#id
  }
}

function main() {
  new Prompt()
}
main()