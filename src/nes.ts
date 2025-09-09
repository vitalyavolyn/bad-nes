import { opcodes } from './opcodes.js'
import { word } from './utils.js'

export class NES {
  // word
  pc = 0
  // bytes
  a = 0
  x = 0
  y = 0

  sp = 0xfd
  // flags
  carry = false
  zero = false
  interruptDisable = true
  decimal = false
  overflow = false
  negative = false

  cycle = 7

  ram = new Uint8Array(2048)
  rom = new Uint8Array()
  chrrom = new Uint8Array()
  header = new Uint8Array()

  halt = false

  public read(address: number): number {
    // TODO: RAM Mirroring?
    // TODO: MAPPERS???
    if (address < 0x800) return this.ram[address]!

    if (address >= 0x8000)
      return this.rom[address - 0x8000]!

    return 0
  }

  public write(address: number, value: number) {
    // todo: no. no. no nonoono
    this.ram[address] = value
  }

  public setZero(value: number) {
    this.zero = value === 0
  }

  public setNegative(value: number) {
    this.negative = value > 127
  }

  public setNZFlags(value: number) {
    this.setNegative(value)
    this.setZero(value)
    console.debug('Set flags', { value, zero: this.zero, neg: this.negative })
  }

  public readPcAndIncrement(): number {
    const result = this.read(this.pc)
    this.pc++
    return result
  }

  public readZeroPage(): number {
    return this.readPcAndIncrement()
  }

  public readZeroPageXIndexed(): number {
    const address = this.readPcAndIncrement()
    return (address + this.x) & 0xFF
  }

  public readZeroPageYIndexed(): number {
    const address = this.readPcAndIncrement()
    return (address + this.y) & 0xFF
  }

  public readAbsolute(): number {
    const lo = this.readPcAndIncrement()
    const hi = this.readPcAndIncrement()
    const address = word(lo, hi)
    return address
  }

  // TODO: +1 cycle when crossing pages?
  public readAbsoluteXIndexed(): number {
    const lo = this.readPcAndIncrement()
    const hi = this.readPcAndIncrement()
    const address = word(lo, hi) + this.x
    return address
  }

  public readAbsoluteYIndexed(): number {
    const lo = this.readPcAndIncrement()
    const hi = this.readPcAndIncrement()
    const address = word(lo, hi) + this.y
    return address
  }

  public readIndirectX(): number {
    const zeroPageAddr = this.readPcAndIncrement()
    const indirectAddr = (zeroPageAddr + this.x) & 0xFF
    const lo = this.read(indirectAddr)
    const hi = this.read((indirectAddr + 1) & 0xFF)
    return word(lo, hi)
  }

  public readIndirectY(): number {
    const zeroPageAddr = this.readPcAndIncrement()
    const lo = this.read(zeroPageAddr)
    const hi = this.read((zeroPageAddr + 1) & 0xFF)
    const address = word(lo, hi) + this.y
    return address
  }

  private tick() {
    const opcode = this.readPcAndIncrement()

    if (opcodes[opcode]) {
      console.debug({
        op: opcode.toString(16),
        pc: (this.pc - 1).toString(16),
        x: this.x.toString(16),
        cycle: this.cycle,
      })
      const cycles = opcodes[opcode](this)
      this.cycle += cycles
    }
    else {
      console.warn('unknown opcode', opcode.toString(16))
    }
  }

  public loadROM(file: ArrayBuffer) {
    this.header = new Uint8Array(file.slice(0, 16))
    this.rom = new Uint8Array(file.slice(16))

    // TODO: i don't understand where this number comes from
    this.chrrom = this.rom.slice(0x8010)
    this.drawPatternTable()

    console.log(this.header)
    console.log(this.rom)

    this.pc = word(this.read(0xFFFC), this.read(0xFFFD))
  }

  public drawPatternTable() {
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 128
    document.body.appendChild(canvas)
    const ctx = canvas.getContext('2d')!

    for (let table = 0; table < 2; table++) {
      for (let row = 0; row < 16; row++) {
        for (let column = 0; column < 16; column++) {
          for (let y = 0; y < 8; y++) {
            const lo = this.chrrom[y + column * 16 + row * 256 + table * 4096]!
            const hi = this.chrrom[8 + y + column * 16 + row * 256 + table * 4096]!
            for (let x = 0; x < 8; x++) {
              let color = ((lo >> (7 - x)) & 1) == 1 ? 1 : 0
              color += ((hi >> (7 - x)) & 1) == 1 ? 1 : 0

              const imageData = ctx.createImageData(1, 1)
              imageData.data[0] = color * 85
              imageData.data[1] = color * 85
              imageData.data[2] = color * 85
              imageData.data[3] = 255
              console.log(color, color * 85, x + column * 8 + table * 128, y + row * 8)
              ctx.putImageData(imageData, x + column * 8 + table * 128, y + row * 8)
            }
          }
        }
      }
    }
  }

  public start() {
    let count = 0
    while (!this.halt) {
      this.tick()
      count++
      if (count > 999) {
        console.info('Stopped execution after 999 ticks')
        break
      }
    }
  }
}
