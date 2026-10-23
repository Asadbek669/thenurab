/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_4092854851")
  const imagesField = collection.fields.find((field) => field.name === "images")
  if (imagesField) {
    imagesField.maxSelect = 10
  } else {
    collection.fields.addAt(3, new Field({
      "help": "",
      "hidden": false,
      "id": "file3760176746",
      "maxSelect": 10,
      "maxSize": 0,
      "mimeTypes": [
        "image/jpeg",
        "image/png",
        "image/vnd.mozilla.apng",
        "image/webp"
      ],
      "name": "images",
      "presentable": false,
      "protected": false,
      "required": false,
      "system": false,
      "thumbs": [],
      "type": "file"
    }))
  }
  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_4092854851")
  const imagesField = collection.fields.find((field) => field.name === "images")
  if (imagesField) {
    imagesField.maxSelect = 0
  }
  return app.save(collection)
})
