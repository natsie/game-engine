"use strict"

const { Game, Sprite, Texture } = Engine
const game = new Game({
  width: "max",
  height: "max",
  background: "#f0f"
}).init()
const circle = new Sprite(Texture.CIRCLE("#f00", 200), {
  physics: {
    behavior: "dynamic",
    hitbox: "circle",
    fencing: true,
    bounciness: 1,
    gravity: 1
  },
  position: {
    x: -120,
    y: -120
  },
  display: {
    width: 100,
    height: 100,
    scale: 1
  }
})
game.addSprite(circle)
game.start()

// const acc = new Accelerometer()
// acc.onreading = function() {
//   circle.physics.gravity = [ -this.x / 3, this.y / 3 ]
// }
// acc.start()
document.addEventListener("mousedown", () => circle.variables.internal.speedY -= 5)