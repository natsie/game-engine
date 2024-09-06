"use strict"

const Engine = (function() {
  function isObject(v) {
    return typeof v === "object" && !Array.isArray(v)
  }
  
  function clampNum(num, min, max) {
    if (num < min) return min
    if (num > max) return max
    return num
  }
  
  function convertAngle(angle, unit) {
    if (unit === "deg" || unit === "d") return angle * 180 / Math.PI
    if (unit === "rad" || unit === "r") return angle * Math.PI / 180
    throw new Error("Invalid unit: `unit` must be one of 'deg' or 'rad'")
  }
  
  function circleCollision(ox, oy, or, tx, ty, tr) {
    const dSquared = ((ox - tx) ** 2) + ((oy - ty) ** 2)
    const rSquared = (or + tr) ** 2
    
    if (dSquared <= rSquared) {
      return {
        collision: true,
        angle: Math.atan((oy - ty) / (ox - tx))
      }
    }
    return false
  }
  
  function circleRectCollision(cx, cy, r, rx, ry, rw, rh) {
    // Find the closest point to the circle on the rectangle
    const closestX = clampNum(cx, rx, rx + rw);
    const closestY = clampNum(cy, ry, ry + rh);

    // Calculate the distance between the circle's center and this closest point
    const distanceX = cx - closestX;
    const distanceY = cy - closestY;

    // Check if the distance is less than the circle's radius
    const distanceSquared = (distanceX * distanceX) + (distanceY * distanceY);
    const radiusSquared = r * r;

    return distanceSquared <= radiusSquared;
  }
  
  class Game {
    constructor({ width = 800, height = 600, background = "#000"} = {}) {
      this.update = this.update.bind(this)
      this.canvasOptions = { width, height, background }
      this.state = { running: false }
      this.events = {
        collisions: [],
        keysDown: {},
        mousePos: []
      }
      this.sprites = []
      this.stats = {
        avgFrameTime: 0,
        frameCount: 0
      }
    }
    
    addSprite(spr) { this.sprites.push(spr) }
    removeSprite(spr) {
      this.sprites.splice(this.sprites.indexOf(spr), 1)
    }
    
    start() {
      if (!this.state.running) {
        this.state.running = true
        this.update()
      }
    }
    halt() {
      this.state.running = false
    }
    
    update() {
      const startTime = Date.now()
      const gc = this.screen.main
      
      for (let i = 0; i < this.sprites.length; i++) {
        const spr = this.sprites[i]
        const scale = spr.display.scale
        const pos = spr.position
        const edgeCol = {
          negX: pos.x - spr.display.width * scale / 2 <= -gc.width / 2,
          negY: pos.y - spr.display.height * scale / 2 <= -gc.height / 2,
          posX: pos.x + spr.display.width * scale / 2 >= gc.width / 2,
          posY: pos.y + spr.display.height * scale / 2 >= gc.height / 2
        }
        
        let grav = []
        if (Array.isArray(spr.physics.gravity)) {
          grav = spr.physics.gravity // gravity on both axis
        } else {
          grav = [ 0, spr.physics.gravity ] // only y gravity
        }
        
        if (spr.physics.behavior === "dynamic") {
          if (!(edgeCol.negY || edgeCol.posY)) {
            spr.variables.internal.speedY += 0.16 * grav[1]
          }
          if (!(edgeCol.negX || edgeCol.posX)) {
            spr.variables.internal.speedX += 0.16 * grav[0]
          }
        }
        
        if (spr.physics.fencing) {
          if (edgeCol.negX || edgeCol.posX) {
            spr.position.x = clampNum(pos.x, (-gc.width + spr.display.width * scale) / 2, (gc.width - spr.display.width) / 2 + .2)
            spr.variables.internal.speedX *= -spr.physics.bounciness
          }
          if (edgeCol.negY || edgeCol.posY) {
            spr.position.y = clampNum(pos.y, (-gc.height + spr.display.height * scale) / 2,(gc.height - spr.display.height) / 2 + .2)
            spr.variables.internal.speedY *= -spr.physics.bounciness
          }
        }
        
        spr.position.x += spr.variables.internal.speedX
        spr.position.y += spr.variables.internal.speedY
      }
      this.render()
      
      this.stats.avgFrameTime = ((this.stats.avgFrameTime * this.stats.frameCount++) + (Date.now() - startTime)) / this.stats.frameCount
      
      this.state.running && requestAnimationFrame(this.update)
    }
    
    render() {
      this.renderer.renderFrame([ this.stage, ...this.sprites ])
    }
    
    init() {
      let { width, height, background } = this.canvasOptions
      const bcr = document.body.getBoundingClientRect()
      const canvas = document.createElement("canvas")
      const ctx = canvas.getContext("2d")
      
      if (width === "max") {
        width = window.innerWidth - (bcr.left * 2)
      }
      if (height === "max") {
        height = window.innerHeight - (bcr.top * 2)
      }
      
      canvas.ctx = ctx
      canvas.width = width
      canvas.height = height
      ctx.background = background
      ctx.clear = function() {
        const { width, height } = this.canvas
        const prevFill = this.fillStyle, prevAlpha = this.globalAlpha
        this.fillStyle = this.background
        this.globalAlpha = 1
        this.fillRect(0, 0, width, height)
        this.fillStyle = prevFill
        this.globalAlpha = prevAlpha
      }
      
      ctx.translate(width / 2, height / 2)
      ctx.clear()
      this.screen = { main: canvas }
      this.stage = new Sprite(Texture.SQUARE(background), {
        display: { width, height }
      })
      this.renderer = new Renderer(ctx)
      document.body.appendChild(canvas)
      return this
    }
  }
  class Renderer {
    constructor(ctx) {
      if (!(ctx instanceof CanvasRenderingContext2D)) {
        throw new Error("Invalid rendering context.")
      }
      this.ctx = ctx
    }
    
    render(spr) {
      const ctx = this.ctx
      const { width, height, scale, costumes, costumeId } = spr.display
      const { r, x, y } = spr.position
      
      let dWidth = (scale * width) / 2
      let dHeight = (scale * height) / 2
      
      ctx.translate(x, y)
      ctx.rotate(r)
      
      ctx.drawImage(
        costumes[costumeId].image, -dWidth, -dHeight, dWidth * 2, dHeight * 2
      )
      
      ctx.translate(-x, -y)
      ctx.rotate(-r)
    }
    renderFrame(entities) {
      if (!Array.isArray(entities)) return false
      
      const zOrder = []
      for (const e of entities) {
        const z = e.properties.position.z
        if (zOrder[z]) {
          zOrder[z].push(e)
          continue
        }
        zOrder[z] = [e]
      }
      
      this.ctx.clear()
      for (let i = 0; i < zOrder.length; i++) {
        const renderArr = zOrder[i]
        if (!renderArr) continue
        
        for (const r of renderArr) this.render(r)
      }
    }
  }
  class Sprite {
    constructor(texture, properties) {
      this.variables = {
        internal: {
          speedX: 0,
          speedY: 0
        }
      }
      this.properties = {
        physics: {
          behavior: "static",
          hitbox: "rectangle",
          interaction: null,
          fencing: true,
          bounciness: 1,
          gravity: 1
        },
        position: {
          r: 0,
          x: 0,
          y: 0,
          z: 0
        },
        display: {
          costumes: [],
          costumeId: 0,
          width: 100,
          height: 100,
          scale: 1
        }
      }
      
      if (texture instanceof Texture) {
        this.properties.display.costumes[0] = texture
      } else if (texture instanceof Image) {
        this.properties.display.costumes[0] = new Texture(texture)
      } else {
        throw new Error("Invalid texture.")
      }
      
      if (isObject(properties)) {
        for (const [ propGroup, value ] of Object.entries(properties)) {
          if (!isObject(value)) continue
          for (const [ prop, val ] of Object.entries(value)) {
            this.properties[propGroup]?.hasOwnProperty(prop) &&
            (this.properties[propGroup][prop] = val)
          }
        }
      }
    }
    
    get physics() { return this.properties.physics }
    set physics(v) {
      const props = this.properties
      props.physics = v
      if (props.physics.bounciness < 0) props.physics.bounciness = 0
    }
    
    get position() { return this.properties.position }
    set position(v) { this.properties.position = v }
    
    get display() { return this.properties.display }
    set display(v) { this.properties.display = v }
  }
  class Texture {
    constructor(img) {
      if (!(img instanceof Image)) throw new Error("Invalid argument.")
      this.image = img
      this.scale = 1
      this.width = img.width
      this.height = img.height
      img.onload = () => {
        this.width = img.width
        this.height = img.height
      }
      img.onerror = () => {
        console.warn("Texture failed to load.")
      }
    }
    
    retrieve() { return this.image }
    
    static CIRCLE(color, quality) {
      !color && (color = "#ffffff")
      !quality && (quality = 2048)
      const canvas = document.createElement("canvas")
      const ctx = canvas.getContext("2d")
      const img = new Image()
      canvas.width = quality
      canvas.height = quality
      ctx.fillStyle = color
      
      ctx.arc(...new Array(3).fill(quality / 2), Math.PI * 2, false)
      ctx.fill()
      
      img.src = canvas.toDataURL()
      return new this(img)
    }
    
    static SQUARE(color, quality) {
      !color && (color = "#ffffff")
      !quality && (quality = 2048)
      const canvas = document.createElement("canvas")
      const ctx = canvas.getContext("2d")
      const img = new Image()
      canvas.width = quality
      canvas.height = quality
      ctx.fillStyle = color
      
      ctx.fillRect(0, 0, quality, quality)
      
      img.src = canvas.toDataURL()
      return new this(img)
    }
  }
  
  return { Game, Sprite, Texture }
})()