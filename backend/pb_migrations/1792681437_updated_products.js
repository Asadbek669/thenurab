/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_4092854851")

  // update field
  collection.fields.addAt(9, new Field({
    "help": "",
    "hidden": false,
    "id": "select1716930793",
    "maxSelect": 15,
    "name": "color",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "select",
    "values": [
      "Qora — #000000",
      "Oq — #FFFFFF",
      "Kulrang — #808080",
      "To'q ko'k (Navy) — #000080",
      "Ko'k — #2563EB",
      "Bej (Beige) — #F5F5DC",
      "Jigarrang — #8B4513",
      "Qizil — #DC2626",
      "Yashil — #16A34A",
      "Zaytun rangi (Olive) — #556B2F",
      "Bordoviy (Maroon) — #800000",
      "Pushti — #EC4899",
      "Binafsha — #7C3AED",
      "Xaki (Khaki) — #C3B091",
      "To'q sariq — #F97316"
    ]
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_4092854851")

  // update field
  collection.fields.addAt(9, new Field({
    "help": "",
    "hidden": false,
    "id": "select1716930793",
    "maxSelect": 0,
    "name": "color",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "select",
    "values": [
      "Qora — #000000",
      "Oq — #FFFFFF",
      "Kulrang — #808080",
      "To'q ko'k (Navy) — #000080",
      "Ko'k — #2563EB",
      "Bej (Beige) — #F5F5DC",
      "Jigarrang — #8B4513",
      "Qizil — #DC2626",
      "Yashil — #16A34A",
      "Zaytun rangi (Olive) — #556B2F",
      "Bordoviy (Maroon) — #800000",
      "Pushti — #EC4899",
      "Binafsha — #7C3AED",
      "Xaki (Khaki) — #C3B091",
      "To'q sariq — #F97316"
    ]
  }))

  return app.save(collection)
})
