function generatePrompts() {
  fetch("http://127.0.0.1:5000/prompts", { method: "POST" })
    .then (r => r.json())
    .then(r => {
      console.log(r)
      if (r.status === 201) {
        window.location.href = "/prompts"
      } else {
        console.error(r)
      }
    })
}

if (window.location.href.endsWith("/prompts")) {
  const imageButtons = [...document.getElementsByClassName("image-button")]
  imageButtons.forEach(ib => {
    ib.addEventListener("click", (e) => {
      const data = new FormData()
      data.append("prompt", e.target.dataset.prompt)
      data.append("prompt_id", e.target.dataset.id)
      fetch("http://127.0.0.1:5000/image", {
        method: "POST",
        body: data
      }).then(r => r.json())
        .then(r => renderImage(r, ib))
        .catch(err => console.error(err))
    })
  })
}

function renderImage(data, element) {
  const imageElem = document.createElement("img")
  imageElem.src = data.image.includes("http") ? data.image : `http://127.0.0.1:5000/static/assets/images/${data.image}`
  imageElem.height = 1024 / 4
  imageElem.width = 1024 / 4
  element.after(imageElem)
}