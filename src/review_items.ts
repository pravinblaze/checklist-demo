interface stringKeyObject {
  [name: string]: string[]
}

const files: stringKeyObject = {
  "file1.txt":[
    "review item a",
    "review item b"
  ],
  "file2.txt":[
    "review item c"
  ],
  "file3.txt":[
    "review item b",
    "review item d"
  ]
}

export {files}