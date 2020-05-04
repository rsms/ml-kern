// import * as tf from "@tensorflow/tfjs-node"
import * as fs from "fs"
import * as featureio from "./featureio"

const log = console.log.bind(console)

// const NUM_PITCH_CLASSES = 7
// const TRAINING_DATA_LENGTH = 7000
// const TEST_DATA_LENGTH = 700

// const model = tf.sequential()
// model.add(tf.layers.dense({units: 250, activation: 'relu', inputShape: [8]}))
// model.add(tf.layers.dense({units: 175, activation: 'relu'}))
// model.add(tf.layers.dense({units: 150, activation: 'relu'}))
// model.add(tf.layers.dense({units: NUM_PITCH_CLASSES, activation: 'softmax'}))

// model.compile({
//   optimizer: tf.train.adam(),
//   loss: 'sparseCategoricalCrossentropy',
//   metrics: ['accuracy']
// })

export function testTrain() {
  log("testTrain")
  console.time("featureio.readSync")
  let trainingData = featureio.readSync("./georgia.bin")
  console.timeEnd("featureio.readSync")
  log({row_of_trainingData: trainingData.row(3)})
}
