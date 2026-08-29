enum ArcDirection {
    //% block="up"
    Up,
    //% block="down"
    Down
}
namespace oled {
    const OLED_ADDR = 0x3C
    const OFFSET = 2

    let buffer = pins.createBuffer(1024)
    let started = false

    function cmd(c: number): void {
        let b = pins.createBuffer(2)
        b[0] = 0x00
        b[1] = c
        pins.i2cWriteBuffer(OLED_ADDR, b)
    }

    function data(buf: Buffer): void {
        let out = pins.createBuffer(buf.length + 1)
        out[0] = 0x40
        for (let i = 0; i < buf.length; i++) {
            out[i + 1] = buf[i]
        }
        pins.i2cWriteBuffer(OLED_ADDR, out)
    }

    function setPage(page: number): void {
        cmd(0xB0 | page)
        cmd(OFFSET & 0x0F)
        cmd(0x10 | ((OFFSET >> 4) & 0x0F))
    }

    //% block="initialise OLED"
    //% group="Basic"
    export function init(): void {
        basic.pause(100)

        cmd(0xAE)              // display off
        cmd(0xD5); cmd(0x80)   // clock divide
        cmd(0xA8); cmd(0x3F)   // multiplex ratio 64
        cmd(0xD3); cmd(0x00)   // display offset
        cmd(0x40)              // display start line
        cmd(0xA1)              // segment remap
        cmd(0xC8)              // COM scan direction
        cmd(0xDA); cmd(0x12)   // COM pins
        cmd(0x81); cmd(0x7F)   // contrast
        cmd(0xD9); cmd(0x22)   // pre-charge
        cmd(0xDB); cmd(0x20)   // VCOMH deselect
        cmd(0xA4)              // resume display from RAM
        cmd(0xA6)              // normal display
        cmd(0xAF)              // display on

        started = true
        clear()
        show()
    }

    //% block="clear drawing"
    //% group="Advanced"
    export function clear(): void {
        for (let j = 0; j < 1024; j++) {
            buffer[j] = 0
        }
    }

    //% block="fill screen %on"
    //% group="Advanced"
    export function fill(on: boolean): void {
        let value = on ? 0xFF : 0x00
        for (let k = 0; k < 1024; k++) {
            buffer[k] = value
        }
    }

    //% block="update OLED"
    //% group="Basic"
    export function show(): void {
        if (!started) {
            init()
            return
        }

        for (let page = 0; page < 8; page++) {
            setPage(page)

            let row = pins.createBuffer(128)
            for (let x = 0; x < 128; x++) {
                row[x] = buffer[page * 128 + x]
            }

            data(row)
        }
    }

    //% block="plot pixel x %x y %y on %on"
    //% group="Advanced"
    //% x.min=0 x.max=127 y.min=0 y.max=63
    export function pixel(x: number, y: number, on: boolean): void {
        if (x < 0 || x > 127 || y < 0 || y > 63) {
            return
        }

        let page2 = Math.idiv(y, 8)
        let index = page2 * 128 + x
        let mask = 1 << (y % 8)

        if (on) {
            buffer[index] = buffer[index] | mask
        } else {
            buffer[index] = buffer[index] & ~mask
        }
    }
    
    
    //% blockId=oled_create_icon
    //% block="icon"
    //% imageLiteral=1
    //% imageLiteralColumns=9
    //% imageLiteralRows=9
    //% shim=images::createImage
    //% weight=0
    export function createIcon(leds: string): Image {
        return <Image><any>leds
    }

    //% blockId=oled_draw_icon
    //% block="draw icon $img at x $x y $y on $on"
    //% group="Drawing"
    //% img.shadow=oled_create_icon
    //% x.min=0 x.max=127
    //% y.min=0 y.max=63
    export function drawIcon(img: Image, x: number, y: number, on: boolean = true): void {
        for (let yy = 0; yy < 9; yy++) {
            for (let xx = 0; xx < 9; xx++) {
                if (img.pixel(xx, yy)) {
                    pixel(x + xx, y + yy, on)
                }
            }
        }
    }


    //% block="draw line from start x %startX y %startY to end x %endX y %endY on %on"
    //% group="Drawing"
    //% x0.min=0 x0.max=127 y0.min=0 y0.max=63
    //% x1.min=0 x1.max=127 y1.min=0 y1.max=63
    export function line(x0: number, y0: number, x1: number, y1: number, on: boolean = true): void {
        let dx = Math.abs(x1 - x0)
        let sx = x0 < x1 ? 1 : -1
        let dy = -Math.abs(y1 - y0)
        let sy = y0 < y1 ? 1 : -1
        let err = dx + dy

        while (true) {
            pixel(x0, y0, on)

            if (x0 == x1 && y0 == y1) {
                break
            }

            let e2 = 2 * err

            if (e2 >= dy) {
                err += dy
                x0 += sx
            }

            if (e2 <= dx) {
                err += dx
                y0 += sy
            }
        }
    }

    //% block="draw rectangle x %x y %y width %w height %h on %on"
    //% group="Drawing"
    //% x.min=0 x.max=127 y.min=0 y.max=63
    //% w.min=0 w.max=127 h.min=0 h.max=63
    export function rect(x: number, y: number, w: number, h: number, on: boolean = true): void {
        line(x, y, x + w, y, on)
        line(x, y, x, y + h, on)
        line(x + w, y, x + w, y + h, on)
        line(x, y + h, x + w, y + h, on)
    }

    function fillRect(x: number, y: number, w: number, h: number, on: boolean): void {
        for (let yy2 = y; yy2 < y + h; yy2++) {
            for (let xx2 = x; xx2 < x + w; xx2++) {
                pixel(xx2, yy2, on)
            }
        }
    }

    //% block="draw circle x %cx y %cy radius %r on %on"
    //% group="Drawing"
    //% cx.min=0 cx.max=127 cy.min=0 cy.max=63 r.min=1 r.max=63
    export function circle(cx: number, cy: number, r: number, on: boolean = true): void {
        let x2 = r
        let y = 0
        let err2 = 0

        while (x2 >= y) {
            pixel(cx + x2, cy + y, on)
            pixel(cx + y, cy + x2, on)
            pixel(cx - y, cy + x2, on)
            pixel(cx - x2, cy + y, on)
            pixel(cx - x2, cy - y, on)
            pixel(cx - y, cy - x2, on)
            pixel(cx + y, cy - x2, on)
            pixel(cx + x2, cy - y, on)

            y += 1

            if (err2 <= 0) {
                err2 += 2 * y + 1
            } else {
                x2 -= 1
                err2 += 2 * (y - x2) + 1
            }
        }
    }
    
    //% block="draw arc from start x %x0 y %y0 to end x %x1 y %y1 height %height direction %direction on %on"
    //% group="Drawing"
    //% x0.min=0 x0.max=127 y0.min=0 y0.max=63
    //% x1.min=0 x1.max=127 y1.min=0 y1.max=63
    //% height.min=0 height.max=63
    export function arc(x0: number, y0: number, x1: number, y1: number, height: number, direction: ArcDirection, on: boolean = true): void {
        if (height < 0) {
            height = 0
        }

        let midX = Math.idiv(x0 + x1, 2)
        let midY = Math.idiv(y0 + y1, 2)

        let controlX = midX
        let controlY = midY

        // A quadratic curve only reaches about half way toward the control point.
        // Doubling this makes the visible arc height match the height entered.
        let controlHeight = height * 2

        if (direction == ArcDirection.Up) {
            controlY = midY - controlHeight
        } else {
            controlY = midY + controlHeight
        }

        let dx2 = Math.abs(x1 - x0)
        let dy2 = Math.abs(y1 - y0)
        let steps = dx2

        if (dy2 > steps) {
            steps = dy2
        }

        steps = steps * 2

        if (steps < 1) {
            steps = 1
        }

        let lastX = x0
        let lastY = y0

        for (let l = 1; l <= steps; l++) {
            let t = l / steps
            let oneMinusT = 1 - t

            let x3 = Math.round(
                oneMinusT * oneMinusT * x0 +
                2 * oneMinusT * t * controlX +
                t * t * x1
            )

            let y2 = Math.round(
                oneMinusT * oneMinusT * y0 +
                2 * oneMinusT * t * controlY +
                t * t * y1
            )

            line(lastX, lastY, x3, y2, on)

            lastX = x3
            lastY = y2
        }
    }

    //% block="draw solid circle x %cx y %cy radius %r on %on"
    //% group="Drawing"
    //% cx.min=0 cx.max=127 cy.min=0 cy.max=63 r.min=1 r.max=63
    export function fillCircle(cx: number, cy: number, r: number, on: boolean = true): void {
        for (let y22 = -r; y22 <= r; y22++) {
            for (let x32 = -r; x32 <= r; x32++) {
                if (x32 * x32 + y22 * y22 <= r * r) {
                    pixel(cx + x32, cy + y22, on)
                }
            }
        }
    }

    const font5x7: number[] = [
        0x00, 0x00, 0x00, 0x00, 0x00, // space
        0x00, 0x00, 0x5F, 0x00, 0x00, // !
        0x00, 0x07, 0x00, 0x07, 0x00, // "
        0x14, 0x7F, 0x14, 0x7F, 0x14, // #
        0x24, 0x2A, 0x7F, 0x2A, 0x12, // $
        0x23, 0x13, 0x08, 0x64, 0x62, // %
        0x36, 0x49, 0x55, 0x22, 0x50, // &
        0x00, 0x05, 0x03, 0x00, 0x00, // '
        0x00, 0x1C, 0x22, 0x41, 0x00, // (
        0x00, 0x41, 0x22, 0x1C, 0x00, // )
        0x14, 0x08, 0x3E, 0x08, 0x14, // *
        0x08, 0x08, 0x3E, 0x08, 0x08, // +
        0x00, 0x50, 0x30, 0x00, 0x00, // ,
        0x08, 0x08, 0x08, 0x08, 0x08, // -
        0x00, 0x60, 0x60, 0x00, 0x00, // .
        0x20, 0x10, 0x08, 0x04, 0x02, // /
        0x3E, 0x51, 0x49, 0x45, 0x3E, // 0
        0x00, 0x42, 0x7F, 0x40, 0x00, // 1
        0x42, 0x61, 0x51, 0x49, 0x46, // 2
        0x21, 0x41, 0x45, 0x4B, 0x31, // 3
        0x18, 0x14, 0x12, 0x7F, 0x10, // 4
        0x27, 0x45, 0x45, 0x45, 0x39, // 5
        0x3C, 0x4A, 0x49, 0x49, 0x30, // 6
        0x01, 0x71, 0x09, 0x05, 0x03, // 7
        0x36, 0x49, 0x49, 0x49, 0x36, // 8
        0x06, 0x49, 0x49, 0x29, 0x1E, // 9
        0x00, 0x36, 0x36, 0x00, 0x00, // :
        0x00, 0x56, 0x36, 0x00, 0x00, // ;
        0x08, 0x14, 0x22, 0x41, 0x00, // <
        0x14, 0x14, 0x14, 0x14, 0x14, // =
        0x00, 0x41, 0x22, 0x14, 0x08, // >
        0x02, 0x01, 0x51, 0x09, 0x06, // ?
        0x32, 0x49, 0x79, 0x41, 0x3E, // @
        0x7E, 0x11, 0x11, 0x11, 0x7E, // A
        0x7F, 0x49, 0x49, 0x49, 0x36, // B
        0x3E, 0x41, 0x41, 0x41, 0x22, // C
        0x7F, 0x41, 0x41, 0x22, 0x1C, // D
        0x7F, 0x49, 0x49, 0x49, 0x41, // E
        0x7F, 0x09, 0x09, 0x09, 0x01, // F
        0x3E, 0x41, 0x49, 0x49, 0x7A, // G
        0x7F, 0x08, 0x08, 0x08, 0x7F, // H
        0x00, 0x41, 0x7F, 0x41, 0x00, // I
        0x20, 0x40, 0x41, 0x3F, 0x01, // J
        0x7F, 0x08, 0x14, 0x22, 0x41, // K
        0x7F, 0x40, 0x40, 0x40, 0x40, // L
        0x7F, 0x02, 0x0C, 0x02, 0x7F, // M
        0x7F, 0x04, 0x08, 0x10, 0x7F, // N
        0x3E, 0x41, 0x41, 0x41, 0x3E, // O
        0x7F, 0x09, 0x09, 0x09, 0x06, // P
        0x3E, 0x41, 0x51, 0x21, 0x5E, // Q
        0x7F, 0x09, 0x19, 0x29, 0x46, // R
        0x46, 0x49, 0x49, 0x49, 0x31, // S
        0x01, 0x01, 0x7F, 0x01, 0x01, // T
        0x3F, 0x40, 0x40, 0x40, 0x3F, // U
        0x1F, 0x20, 0x40, 0x20, 0x1F, // V
        0x3F, 0x40, 0x38, 0x40, 0x3F, // W
        0x63, 0x14, 0x08, 0x14, 0x63, // X
        0x07, 0x08, 0x70, 0x08, 0x07, // Y
        0x61, 0x51, 0x49, 0x45, 0x43,  // Z
        0x00, 0x7F, 0x41, 0x41, 0x41, // [
        0x02, 0x04, 0x08, 0x10, 0x20, // backslash
        0x00, 0x41, 0x41, 0x41, 0x7F, // ]
        0x04, 0x02, 0x01, 0x02, 0x04, // ^
        0x40, 0x40, 0x40, 0x40, 0x40, // _
        0x00, 0x03, 0x07, 0x08, 0x00, // `
        0x20, 0x54, 0x54, 0x78, 0x40, // a
        0x7F, 0x28, 0x44, 0x44, 0x38, // b
        0x38, 0x44, 0x44, 0x44, 0x28, // c
        0x38, 0x44, 0x44, 0x28, 0x7F, // d
        0x38, 0x54, 0x54, 0x54, 0x18, // e
        0x00, 0x08, 0x7E, 0x09, 0x02, // f
        0x18, 0xA4, 0xA4, 0x9C, 0x78, // g
        0x7F, 0x08, 0x04, 0x04, 0x78, // h
        0x00, 0x44, 0x7D, 0x40, 0x00, // i
        0x20, 0x40, 0x40, 0x3D, 0x00, // j
        0x7F, 0x10, 0x28, 0x44, 0x00, // k
        0x00, 0x41, 0x7F, 0x40, 0x00, // l
        0x7C, 0x04, 0x78, 0x04, 0x78, // m
        0x7C, 0x08, 0x04, 0x04, 0x78, // n
        0x38, 0x44, 0x44, 0x44, 0x38, // o
        0xFC, 0x18, 0x24, 0x24, 0x18, // p
        0x18, 0x24, 0x24, 0x18, 0xFC, // q
        0x7C, 0x08, 0x04, 0x04, 0x08, // r
        0x48, 0x54, 0x54, 0x54, 0x24, // s
        0x04, 0x04, 0x3F, 0x44, 0x24, // t
        0x3C, 0x40, 0x40, 0x20, 0x7C, // u
        0x1C, 0x20, 0x40, 0x20, 0x1C, // v
        0x3C, 0x40, 0x30, 0x40, 0x3C, // w
        0x44, 0x28, 0x10, 0x28, 0x44, // x
        0x4C, 0x90, 0x90, 0x90, 0x7C, // y
        0x44, 0x64, 0x54, 0x4C, 0x44, // z
        0x00, 0x08, 0x36, 0x41, 0x00, // {
        0x00, 0x00, 0x77, 0x00, 0x00, // |
        0x00, 0x41, 0x36, 0x08, 0x00, // }
        0x02, 0x01, 0x02, 0x04, 0x02  // ~
    ]

    function drawChar(ch: string, x: number, y: number, size: number, on: boolean): void {
        let code = ch.charCodeAt(0)

        if (code < 32 || code > 126) {
            code = 63
        }

        let index2 = (code - 32) * 5

        for (let col = 0; col < 5; col++) {
            let lineBits = font5x7[index2 + col]

            for (let row2 = 0; row2 < 8; row2++) {
                if ((lineBits & (1 << row2)) != 0) {
                    if (size <= 1) {
                        pixel(x + col, y + row2, on)
                    } else {
                        fillRect(x + col * size, y + row2 * size, size, size, on)
                    }
                }
            }
        }
    }

    function drawCharCN(code: number, x: number, y: number, on: boolean): void {
        let idx = -1
        for (let i = 0; i < FONT_CN_CODES.length; i += 2) {
            // & 0xFF ensures unsigned byte comparison (device may return signed bytes)
            let hi = FONT_CN_CODES[i] & 0xFF
            let lo = FONT_CN_CODES[i + 1] & 0xFF
            if (((hi << 8) | lo) === code) {
                idx = i / 2
                break
            }
        }
        if (idx < 0) {
            return
        }
        // Single flat buffer: offset = idx * 32
        let offset = idx * 32

        for (let col = 0; col < 16; col++) {
            let topByte = FONT_CN_DATA[offset + col]
            let botByte = FONT_CN_DATA[offset + 16 + col]

            // LSB-first: glyph top row (bit 0, per gen_font_cn_buffer.py
            // top |= (1 << row)) maps to screen top (pixel mask 1 << (y % 8),
            // same as ASCII drawChar). Bit 7 = row 7 of glyph half.
            for (let row = 0; row < 8; row++) {
                if ((topByte & (1 << row)) != 0) {
                    pixel(x + col, y + row, on)
                }
            }
            for (let row = 0; row < 8; row++) {
                if ((botByte & (1 << row)) != 0) {
                    pixel(x + col, y + 8 + row, on)
                }
            }
        }
    }

    //% block="show text %message x %x y %y size %size"
    //% group="Basic"
    //% x.min=0 x.max=127 y.min=0 y.max=63 size.min=1 size.max=4
    export function showText(message: string, x: number, y: number, size: number = 1): void {
        if (!started) {
            init()
        }

        clear()
        text(message, x, y, size, true)
        show()
    }

    //% block="draw text %message x %x y %y size %size on %on"
    //% group="Advanced"
    //% x.min=0 x.max=127 y.min=0 y.max=63 size.min=1 size.max=4
    export function text(message: string, x: number, y: number, size: number = 1, on: boolean = true): void {
        if (size < 1) {
            size = 1
        }
        if (size > 4) {
            size = 4
        }

        let curX = x
        let m = 0
        while (m < message.length) {
            let b0 = message.charCodeAt(m)
            if (b0 < 0x80) {
                drawChar(String.fromCharCode(b0), curX, y, size, on)
                curX += 6 * size
                m++
            } else if ((b0 & 0xE0) == 0xC0) {
                let cp = ((b0 & 0x1F) << 6) | (message.charCodeAt(m + 1) & 0x3F)
                drawCharCN(cp, curX, y, on)
                curX += 17 * size
                m += 2
            } else if ((b0 & 0xF0) == 0xE0) {
                let cp = ((b0 & 0x0F) << 12) | ((message.charCodeAt(m + 1) & 0x3F) << 6) | (message.charCodeAt(m + 2) & 0x3F)
                drawCharCN(cp, curX, y, on)
                curX += 17 * size
                m += 3
            } else {
                m++
            }
        }
    }

    // Chinese phrase buffers — UInt16BE code points, bypass PXT string truncation
    const CN_BUF_0: Buffer = hex`4F60597D4E16754C`
    const CN_BUF_1: Buffer = hex`4F60597D`
    const CN_BUF_2: Buffer = hex`6E295EA64F20611F5668`
    const CN_BUF_3: Buffer = hex`4ECA592959296C14`
    const CN_BUF_4: Buffer = hex`52A051CF4E589664`
    const CN_BUF_5: Buffer = hex`6211723151664E60`
    const CN_BUF_6: Buffer = hex`65705357`

    function renderCN(buf: Buffer, x: number, y: number, size: number, on: boolean): void {
        let curX = x
        for (let i = 0; i < buf.length; i += 2) {
            let hi = buf[i] & 0xFF
            let lo = buf[i + 1] & 0xFF
            let cp = (hi << 8) | lo
            drawCharCN(cp, curX, y, on)
            curX += 17 * size
        }
    }

    //% block="show 你好世界 x %x y %y size %size"
    //% group="Advanced"
    //% x.min=0 x.max=127 y.min=0 y.max=63 size.min=1 size.max=4
    export function showCNHelloWorld(x: number, y: number, size: number = 1): void {
        if (!started) init()
        clear()
        renderCN(CN_BUF_0, x, y, size, true)
        show()
    }

    //% block="show 你好 x %x y %y size %size"
    //% group="Advanced"
    //% x.min=0 x.max=127 y.min=0 y.max=63 size.min=1 size.max=4
    export function showCNHello(x: number, y: number, size: number = 1): void {
        if (!started) init()
        clear()
        renderCN(CN_BUF_1, x, y, size, true)
        show()
    }

    //% block="show 温度传感器 x %x y %y size %size"
    //% group="Advanced"
    //% x.min=0 x.max=127 y.min=0 y.max=63 size.min=1 size.max=4
    export function showCNTempSensor(x: number, y: number, size: number = 1): void {
        if (!started) init()
        clear()
        renderCN(CN_BUF_2, x, y, size, true)
        show()
    }

    //% block="show 今天天气 x %x y %y size %size"
    //% group="Advanced"
    //% x.min=0 x.max=127 y.min=0 y.max=63 size.min=1 size.max=4
    export function showCNWeather(x: number, y: number, size: number = 1): void {
        if (!started) init()
        clear()
        renderCN(CN_BUF_3, x, y, size, true)
        show()
    }

    //% block="show 加减乘除 x %x y %y size %size"
    //% group="Advanced"
    //% x.min=0 x.max=127 y.min=0 y.max=63 size.min=1 size.max=4
    export function showCNMath(x: number, y: number, size: number = 1): void {
        if (!started) init()
        clear()
        renderCN(CN_BUF_4, x, y, size, true)
        show()
    }

    //% block="show 我爱学习 x %x y %y size %size"
    //% group="Advanced"
    //% x.min=0 x.max=127 y.min=0 y.max=63 size.min=1 size.max=4
    export function showCNLoveLearn(x: number, y: number, size: number = 1): void {
        if (!started) init()
        clear()
        renderCN(CN_BUF_5, x, y, size, true)
        show()
    }

    //% block="show 数字 x %x y %y size %size"
    //% group="Advanced"
    //% x.min=0 x.max=127 y.min=0 y.max=63 size.min=1 size.max=4
    export function showCNNumber(x: number, y: number, size: number = 1): void {
        if (!started) init()
        clear()
        renderCN(CN_BUF_6, x, y, size, true)
        show()
    }

}
