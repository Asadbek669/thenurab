/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_4092854851")
  collection.fields.getByName("size").maxSelect = 5
  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_4092854851")
  collection.fields.getByName("size").maxSelect = 0
  return app.save(collection)
})
