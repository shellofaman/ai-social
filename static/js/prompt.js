async function loadImages(id) {
  const result = await fetch(`http://127.0.0.1:5000/prompt/${id}/images`)
  if (result.ok) {
    const data = await result.json()
    renderImages(data.images)
  }
}

function renderImages(images) {
  const elem = [...document.getElementsByTagName("body")]
  if (elem.length === 0) return
  images.forEach(image => {
    const img = document.createElement("img")
    img.src = image.url.includes("http") ? image.url : `http://127.0.0.1:5000/static/assets/images/${image.url}`
    img.height = 1024 / 4
    img.width = 1024 / 4
    elem[0].appendChild(img)
  });
}