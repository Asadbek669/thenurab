/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const products = app.findCollectionByNameOrId("pbc_4092854851")
  unmarshal({
    "createRule": null,
    "updateRule": null,
    "deleteRule": null
  }, products)
  app.save(products)

  const banners = app.findCollectionByNameOrId("pbc_1485751721")
  unmarshal({
    "listRule": "",
    "viewRule": "",
    "createRule": null,
    "updateRule": null,
    "deleteRule": null
  }, banners)
  app.save(banners)

  const orders = app.findCollectionByNameOrId("pbc_3527180448")
  unmarshal({
    "listRule": null,
    "viewRule": null,
    "createRule": null,
    "updateRule": null,
    "deleteRule": null
  }, orders)
  app.save(orders)

  const users = app.findCollectionByNameOrId("pbc_2862526969")
  users.fields.addAt(users.fields.length, new Field({
    "autogeneratePattern": "",
    "help": "",
    "hidden": false,
    "id": "text623847201",
    "max": 0,
    "min": 0,
    "name": "address",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))
  users.indexes = ["CREATE UNIQUE INDEX idx_user_telegram_id ON user (telegram_id) WHERE telegram_id != ''"]
  unmarshal({
    "listRule": null,
    "viewRule": null,
    "createRule": null,
    "updateRule": null,
    "deleteRule": null
  }, users)
  return app.save(users)
}, (app) => {
  const users = app.findCollectionByNameOrId("pbc_2862526969")
  users.fields.removeById("text623847201")
  users.indexes = []
  unmarshal({
    "listRule": "",
    "viewRule": "",
    "createRule": "",
    "updateRule": "",
    "deleteRule": ""
  }, users)
  app.save(users)

  const orders = app.findCollectionByNameOrId("pbc_3527180448")
  unmarshal({
    "listRule": "",
    "viewRule": "",
    "createRule": "",
    "updateRule": "",
    "deleteRule": ""
  }, orders)
  app.save(orders)

  const banners = app.findCollectionByNameOrId("pbc_1485751721")
  unmarshal({
    "listRule": null,
    "viewRule": null,
    "createRule": "",
    "updateRule": "",
    "deleteRule": ""
  }, banners)
  app.save(banners)

  const products = app.findCollectionByNameOrId("pbc_4092854851")
  unmarshal({
    "createRule": "",
    "updateRule": ""
  }, products)
  return app.save(products)
})
