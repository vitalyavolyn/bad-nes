import { opcodes } from './opcodes.js'
import { word } from './utils.js'

export class NES {
  // word
  // TODO: should overflow
  // // what?
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

    console.log(this.header)
    console.log(this.rom)

    this.pc = word(this.read(0xFFFC), this.read(0xFFFD))
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
