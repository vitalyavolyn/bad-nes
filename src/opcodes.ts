import type { NES } from './nes.js'
import { decByte, hi, incByte, lo, uint8ToInt8, word } from './utils.js'

type OpcodeImpl = (nes: NES) => number

const push = (nes: NES, val: number) => {
  nes.write(0x100 + nes.sp, val)
  console.debug('push!', val.toString(16))
  nes.sp = decByte(nes.sp)
}
const pull = (nes: NES) => {
  nes.sp = incByte(nes.sp)
  console.debug('pull!', nes.read(0x100 + nes.sp).toString(16))
  return nes.read(0x100 + nes.sp)
}

const opInc = (nes: NES, address: number, value: number) => {
  const newVal = incByte(value)
  nes.write(address, newVal)
  nes.setNZFlags(newVal)
}

const opDec = (nes: NES, address: number, value: number) => {
  const newVal = decByte(value)
  nes.write(address, newVal)
  nes.setNZFlags(newVal)
}

const opOra = (nes: NES, value: number) => {
  nes.a |= value
  nes.setNZFlags(nes.a)
}

const opAnd = (nes: NES, value: number) => {
  nes.a &= value
  nes.setNZFlags(nes.a)
}

const opEor = (nes: NES, value: number) => {
  nes.a ^= value
  nes.setNZFlags(nes.a)
}

// may be wrong
const opAdc = (nes: NES, value: number) => {
  let sum = nes.a + value + Number(nes.carry)
  nes.carry = sum > 0xff
  sum &= 0xff
  nes.overflow = Boolean((sum ^ nes.a) & (sum ^ value) & 0x80)
  nes.a = sum
  nes.setNZFlags(nes.a)
}

const opSbc = (nes: NES, value: number) => {
  let result = nes.a - value - (1 - Number(nes.carry))
  nes.carry = result >= 0
  result &= 0xff
  nes.overflow = Boolean((result ^ nes.a) & (result ^ (~value)) & 0x80)
  nes.a = result
  nes.setNZFlags(nes.a)
}

const opCmp = (nes: NES, value: number) => {
  nes.carry = nes.a >= value
  nes.zero = value == nes.a
  nes.negative = (((nes.a - value) & 0xff) & 0x80) !== 0
}

const opBit = (nes: NES, address: number) => {
  const memory = nes.read(address)
  const result = nes.a & memory
  nes.zero = result === 0
  nes.overflow = Boolean(memory & (1 << 6))
  nes.negative = Boolean(memory & (1 << 7))
}

const opAsl = (nes: NES, value: number): number => {
  nes.carry = value > 127
  return (value << 1) & 0xff
}

const opRol = (nes: NES, value: number): number => {
  const laterCarry = value > 127
  let result = (value << 1) & 0xff
  if (nes.carry) result |= 1
  nes.carry = laterCarry
  return result
}

const opLsr = (nes: NES, value: number): number => {
  nes.carry = (value & 1) > 0
  return value >> 1
}

const opRor = (nes: NES, value: number): number => {
  const laterCarry = (value & 1) > 0
  let result = value >> 1
  if (nes.carry) result |= 128
  nes.carry = laterCarry
  return result
}

const opSta = (nes: NES, address: number) => {
  nes.write(address, nes.a)
}

const opStx = (nes: NES, address: number) => {
  nes.write(address, nes.x)
}

const opSty = (nes: NES, address: number) => {
  nes.write(address, nes.y)
}

export const opcodes: Record<number, OpcodeImpl> = {
  0x02(nes) { // HLT
    nes.halt = true
    console.debug('halt!', nes.ram)
    // TODO: what
    return 1
  },
  0x85(nes) { // STA zero page
    const address = nes.readPcAndIncrement()
    opSta(nes, address)
    return 3
  },
  0x8D(nes) { // STA absolute
    const lo = nes.readPcAndIncrement()
    const hi = nes.readPcAndIncrement()
    opSta(nes, word(lo, hi))
    return 4
  },

  0x86(nes) { // STX zero page
    const address = nes.readPcAndIncrement()
    opStx(nes, address)
    return 3
  },
  0x8E(nes) { // STX absolute
    const lo = nes.readPcAndIncrement()
    const hi = nes.readPcAndIncrement()
    opStx(nes, word(lo, hi))
    return 4
  },

  0x84(nes) { // STY zero page
    const address = nes.readPcAndIncrement()
    opSty(nes, address)
    return 3
  },
  0x8C(nes) { // STY absolute
    const lo = nes.readPcAndIncrement()
    const hi = nes.readPcAndIncrement()
    opSty(nes, word(lo, hi))
    return 4
  },

  0xA0(nes) { // LDY immediate
    nes.y = nes.readPcAndIncrement()
    nes.setNZFlags(nes.y)
    return 2
  },
  0xA2(nes) { // LDX immediate
    nes.x = nes.readPcAndIncrement()
    nes.setNZFlags(nes.x)
    return 2
  },
  0xA5(nes) { // LDA zero page
    nes.a = nes.readZeroPage()
    nes.setNZFlags(nes.a)
    return 3
  },
  0xA9(nes) { // LDA immediate
    nes.a = nes.readPcAndIncrement()
    nes.setNZFlags(nes.a)
    return 2
  },
  0xAD(nes) { // LDA absolute
    nes.a = nes.readAbsolute()
    nes.setNZFlags(nes.a)
    return 4
  },

  // branches
  0x10(nes) { // BPL Branch on Plus
    const offset = uint8ToInt8(nes.readPcAndIncrement())
    if (!nes.negative) {
      nes.pc += offset
      return 3
    }
    return 2
  },
  0x30(nes) { // BMI Branch on Minus
    const offset = uint8ToInt8(nes.readPcAndIncrement())
    if (nes.negative) {
      nes.pc += offset
      return 3
    }
    return 2
  },
  0x50(nes) { // BVC Branch on Overflow Clear
    const offset = uint8ToInt8(nes.readPcAndIncrement())
    if (!nes.overflow) {
      nes.pc += offset
      return 3
    }
    return 2
  },
  0x70(nes) { // BVS Branch on Overflow Set
    const offset = uint8ToInt8(nes.readPcAndIncrement())
    if (nes.overflow) {
      nes.pc += offset
      return 3
    }
    return 2
  },
  0x90(nes) { // BCC Branch on Carry Clear
    const offset = uint8ToInt8(nes.readPcAndIncrement())
    if (!nes.carry) {
      nes.pc += offset
      return 3
    }
    return 2
  },
  0xB0(nes) { // BCS Branch on Carry Set
    const offset = uint8ToInt8(nes.readPcAndIncrement())
    if (nes.carry) {
      nes.pc += offset
      return 3
    }
    return 2
  },
  0xD0(nes) { // BNE Branch on Not Equal
    const offset = uint8ToInt8(nes.readPcAndIncrement())
    if (!nes.zero) {
      nes.pc += offset
      return 3
    }
    return 2
  },
  0xF0(nes) { // BEQ Branch on Equal
    const offset = uint8ToInt8(nes.readPcAndIncrement())
    if (nes.zero) {
      nes.pc += offset
      return 3
    }
    return 2
  },

  0x48(nes) { // PHA
    push(nes, nes.a)
    return 3
  },
  0x68(nes) { // PLA
    nes.a = pull(nes)
    nes.setNZFlags(nes.a)
    return 4
  },

  0x20(nes) { // JSR
    const destLo = nes.readPcAndIncrement()
    const destHi = nes.readPcAndIncrement()
    nes.pc--
    push(nes, hi(nes.pc))
    push(nes, lo(nes.pc))
    nes.pc = word(destLo, destHi)
    return 6
  },
  0x60(nes) { // RTS
    const pcLo = pull(nes)
    const pcHi = pull(nes)
    nes.pc = word(pcLo, pcHi) + 1
    return 6
  },
  0x4C(nes) { // JMP
    const destLo = nes.readPcAndIncrement()
    const destHi = nes.readPcAndIncrement()
    nes.pc = word(destLo, destHi)
    return 3
  },

  0xE8(nes) { // INX
    nes.x = incByte(nes.x)
    nes.setNZFlags(nes.x)
    return 2
  },
  0xCA(nes) { // DEX
    nes.x = decByte(nes.x)
    nes.setNZFlags(nes.x)
    return 2
  },
  0xC8(nes) { // INY
    nes.y = incByte(nes.y)
    nes.setNZFlags(nes.y)
    return 2
  },
  0x88(nes) { // DEY
    nes.y = decByte(nes.y)
    nes.setNZFlags(nes.y)
    return 2
  },
  0xAA(nes) { // TAX
    nes.x = nes.a
    nes.setNZFlags(nes.x)
    return 2
  },
  0x8A(nes) { // TXA
    nes.a = nes.x
    nes.setNZFlags(nes.a)
    return 2
  },
  0xA8(nes) { // TAY
    nes.y = nes.a
    nes.setNZFlags(nes.y)
    return 2
  },
  0x98(nes) { // TYA
    nes.a = nes.y
    nes.setNZFlags(nes.a)
    return 2
  },
  0x9A(nes) { // TXS
    nes.sp = nes.x
    return 2
  },
  0xBA(nes) { // TSX
    nes.x = nes.sp
    nes.setNZFlags(nes.x)
    return 2
  },
  0x38(nes) { // SEC
    nes.carry = true
    return 2
  },
  0x18(nes) { // CLC
    nes.carry = false
    return 2
  },
  0xB8(nes) { // CLV
    nes.overflow = false
    return 2
  },
  0x78(nes) { // SEI
    nes.interruptDisable = true
    return 2
  },
  0x58(nes) { // CLI
    nes.interruptDisable = false
    return 2
  },
  0xF8(nes) { // SED
    nes.decimal = true
    return 2
  },
  0xD8(nes) { // CLD
    nes.decimal = false
    return 2
  },
  0xEA() { // NOP
    return 2
  },
  0x08(nes) { // PHP
    let flags = 0
    flags += Number(nes.carry)
    flags += Number(nes.zero) << 1
    flags += Number(nes.interruptDisable) << 2
    flags += Number(nes.decimal) << 3
    flags += 1 << 4
    flags += 1 << 5
    flags += Number(nes.overflow) << 6
    flags += Number(nes.negative) << 7
    push(nes, flags)
    return 3
  },
  0x28(nes) { // PLP
    const flags = pull(nes)
    nes.carry = (flags & 1) != 0
    nes.zero = (flags & (1 << 1)) != 0
    nes.interruptDisable = (flags & (1 << 2)) != 0
    nes.decimal = (flags & (1 << 3)) != 0
    nes.overflow = (flags & (1 << 6)) != 0
    nes.negative = (flags & (1 << 7)) != 0
    return 3
  },
  0x0A(nes) { // ASL a
    nes.a = opAsl(nes, nes.a)
    nes.setNZFlags(nes.a)
    return 2
  },
  0x2A(nes) { // ROL a
    nes.a = opRol(nes, nes.a)
    nes.setNZFlags(nes.a)
    return 2
  },
  // TODO: merge these two
  0x06(nes) { // ASL zero page
    const addr = nes.readPcAndIncrement()
    const val = nes.read(addr)
    const result = opAsl(nes, val)
    nes.setNZFlags(result)
    nes.write(addr, result)
    return 5
  },
  0x0E(nes) { // ASL abs
    const destLo = nes.readPcAndIncrement()
    const destHi = nes.readPcAndIncrement()
    const addr = word(destLo, destHi)
    const val = nes.read(addr)
    const result = opAsl(nes, val)
    nes.setNZFlags(result)
    nes.write(addr, result)
    return 6
  },
  // TODO: merge these two
  0x26(nes) { // ROL zero page
    const addr = nes.readPcAndIncrement()
    const val = nes.read(addr)
    const result = opRol(nes, val)
    nes.setNZFlags(result)
    nes.write(addr, result)
    return 5
  },
  0x2E(nes) { // ROL abs
    const destLo = nes.readPcAndIncrement()
    const destHi = nes.readPcAndIncrement()
    const addr = word(destLo, destHi)
    const val = nes.read(addr)
    const result = opRol(nes, val)
    nes.setNZFlags(result)
    nes.write(addr, result)
    return 6
  },
  0x4A(nes) { // LSR a
    nes.a = opLsr(nes, nes.a)
    nes.setNZFlags(nes.a)
    return 2
  },
  0x6A(nes) { // ROR a
    nes.a = opRor(nes, nes.a)
    nes.setNZFlags(nes.a)
    return 2
  },
  // TODO: merge these two
  0x46(nes) { // LSR zero page
    const addr = nes.readPcAndIncrement()
    const val = nes.read(addr)
    const result = opLsr(nes, val)
    nes.setNZFlags(result)
    nes.write(addr, result)
    return 5
  },
  0x4E(nes) { // LSR abs
    const destLo = nes.readPcAndIncrement()
    const destHi = nes.readPcAndIncrement()
    const addr = word(destLo, destHi)
    const val = nes.read(addr)
    const result = opLsr(nes, val)
    nes.setNZFlags(result)
    nes.write(addr, result)
    return 6
  },
  // TODO: merge these two
  0x66(nes) { // ROR zero page
    const addr = nes.readPcAndIncrement()
    const val = nes.read(addr)
    const result = opRor(nes, val)
    nes.setNZFlags(result)
    nes.write(addr, result)
    return 5
  },
  0x6E(nes) { // ROR abs
    const destLo = nes.readPcAndIncrement()
    const destHi = nes.readPcAndIncrement()
    const addr = word(destLo, destHi)
    const val = nes.read(addr)
    const result = opRor(nes, val)
    nes.setNZFlags(result)
    nes.write(addr, result)
    return 6
  },
  0xE6(nes) { // INC zero
    const addr = nes.readPcAndIncrement()
    const val = nes.read(addr)
    opInc(nes, addr, val)
    return 5
  },
  0xEE(nes) { // INC abs
    const destLo = nes.readPcAndIncrement()
    const destHi = nes.readPcAndIncrement()
    const addr = word(destLo, destHi)
    const val = nes.read(addr)
    opInc(nes, addr, val)
    return 6
  },
  0xC6(nes) { // DEC zero
    const addr = nes.readPcAndIncrement()
    const val = nes.read(addr)
    opDec(nes, addr, val)
    return 5
  },
  0xCE(nes) { // DEC abs
    const destLo = nes.readPcAndIncrement()
    const destHi = nes.readPcAndIncrement()
    const addr = word(destLo, destHi)
    const val = nes.read(addr)
    opDec(nes, addr, val)
    return 6
  },
  0x09(nes) { // ORA imm
    const value = nes.readPcAndIncrement()
    opOra(nes, value)
    return 2
  },
  0x05(nes) { // ORA zero
    const val = nes.readZeroPage()
    opOra(nes, val)
    return 3
  },
  0x0D(nes) { // ORA abs
    const val = nes.readAbsolute()
    opOra(nes, val)
    return 4
  },
  0x29(nes) { // AND imm
    const value = nes.readPcAndIncrement()
    opAnd(nes, value)
    return 2
  },
  0x25(nes) { // AND zero
    const val = nes.readZeroPage()
    opAnd(nes, val)
    return 3
  },
  0x2D(nes) { // AND abs
    const val = nes.readAbsolute()
    opAnd(nes, val)
    return 4
  },
  0x49(nes) { // EOR imm
    const value = nes.readPcAndIncrement()
    opEor(nes, value)
    return 2
  },
  0x45(nes) { // EOR zero
    const val = nes.readZeroPage()
    opEor(nes, val)
    return 3
  },
  0x4D(nes) { // EOR abs
    const val = nes.readAbsolute()
    opEor(nes, val)
    return 4
  },
  0x69(nes) { // ADC imm
    const value = nes.readPcAndIncrement()
    opAdc(nes, value)
    return 2
  },
  0x65(nes) { // ADC zero
    const val = nes.readZeroPage()
    opAdc(nes, val)
    return 3
  },
  0x6D(nes) { // ADC abs
    const val = nes.readAbsolute()
    opAdc(nes, val)
    return 4
  },
  0xE9(nes) { // SBC imm
    const value = nes.readPcAndIncrement()
    opSbc(nes, value)
    return 2
  },
  0xE5(nes) { // SBC zero
    const val = nes.readZeroPage()
    opSbc(nes, val)
    return 3
  },
  0xED(nes) { // SBC abs
    const val = nes.readAbsolute()
    opSbc(nes, val)
    return 4
  },
  0xC9(nes) { // CMP imm
    const value = nes.readPcAndIncrement()
    opCmp(nes, value)
    return 2
  },
  0xC5(nes) { // CMP zero
    const val = nes.readZeroPage()
    opCmp(nes, val)
    return 3
  },
  0xCD(nes) { // CMP abs
    const val = nes.readAbsolute()
    opCmp(nes, val)
    return 4
  },
  0x24(nes) { // BIT zero
    const addr = nes.readPcAndIncrement()
    opBit(nes, addr)
    return 3
  },
  0x2C(nes) { // BIT abs
    const destLo = nes.readPcAndIncrement()
    const destHi = nes.readPcAndIncrement()
    const addr = word(destLo, destHi)
    opBit(nes, addr)
    return 4
  },

  0x00(nes) { // BRK
    push(nes, hi(nes.pc))
    push(nes, lo(nes.pc))
    let flags = 0
    flags += Number(nes.carry)
    flags += Number(nes.zero) << 1
    flags += Number(nes.interruptDisable) << 2
    flags += Number(nes.decimal) << 3
    flags += 1 << 4
    flags += 1 << 5
    flags += Number(nes.overflow) << 6
    flags += Number(nes.negative) << 7
    push(nes, flags)

    nes.pc = word(nes.read(0xFFFE), nes.read(0xFFFF))

    return 7
  },

  0x40(nes) { // RTI
    const flags = pull(nes)
    nes.carry = (flags & 1) != 0
    nes.zero = (flags & (1 << 1)) != 0
    nes.interruptDisable = (flags & (1 << 2)) != 0
    nes.decimal = (flags & (1 << 3)) != 0
    nes.overflow = (flags & (1 << 6)) != 0
    nes.negative = (flags & (1 << 7)) != 0
    const pcLo = pull(nes)
    const pcHi = pull(nes)
    nes.pc = word(pcLo, pcHi)

    return 6
  },
}
