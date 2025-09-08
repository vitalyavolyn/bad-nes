import { opcodes } from './opcodes.js'
import { word } from './utils.js'

export class NES {
  // word
  // TODO: should overflow
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

  private tick() {
    const opcode = this.readPcAndIncrement()

    if (opcodes[opcode]) {
      console.log({ op: opcode.toString(16), pc: this.pc })
      opcodes[opcode](this)
      console.debug({ pc: this.pc })
    }
    else {
      console.warn('unknown opcode', opcode)
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
    while (!this.halt) {
      this.tick()
    }
  }
}
