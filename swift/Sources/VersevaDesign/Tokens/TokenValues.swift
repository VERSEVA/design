// Token value types for VERSEVA Design.
//
// Hand-written. The files in ../Generated are produced from tokens.css by
// bin/emit-swift.mjs and are built from the types in this file. Plain data
// only: no SwiftUI here. Mapping these values to Color, Animation, Font and
// shadow modifiers is the job of the hand-written layer above this one.
//
// TokenSet must declare exactly the fields the generator writes, in the same
// order (bin/swift-emitter.mjs, GROUPS). test/swift-emitter.test.mjs fails
// when the two disagree.

/// An sRGB color. Each component runs from 0 to 1; alpha is not premultiplied.
public struct TokenColor: Sendable, Equatable {
    public let r: Double
    public let g: Double
    public let b: Double
    public let a: Double

    public init(r: Double, g: Double, b: Double, a: Double) {
        self.r = r
        self.g = g
        self.b = b
        self.a = a
    }
}

/// A drop shadow, approximated from a CSS box-shadow: the offset and color
/// are kept, the CSS spread is dropped, and radius is the CSS blur divided
/// by 2. Offsets and radius are in points.
public struct TokenShadow: Sendable, Equatable {
    public let x: Double
    public let y: Double
    public let radius: Double
    public let color: TokenColor

    public init(x: Double, y: Double, radius: Double, color: TokenColor) {
        self.x = x
        self.y = y
        self.radius = radius
        self.color = color
    }
}

/// The two control points of a CSS cubic-bezier() timing function.
public struct TimingCurve: Sendable, Equatable {
    public let x1: Double
    public let y1: Double
    public let x2: Double
    public let y2: Double

    public init(x1: Double, y1: Double, x2: Double, y2: Double) {
        self.x1 = x1
        self.y1 = y1
        self.x2 = x2
        self.y2 = y2
    }
}

/// Every generated token for one theme in one mode (dark or light).
/// Spacing, radius and shadow values are in points; durations in seconds.
public struct TokenSet: Sendable, Equatable {
    public let bg: TokenColor
    public let surface: TokenColor
    public let surface2: TokenColor
    public let hairlineSoft: TokenColor
    public let hairline: TokenColor
    public let hairlineStrong: TokenColor
    public let text1: TokenColor
    public let text2: TokenColor
    public let text3: TokenColor
    public let accent: TokenColor
    public let accentHover: TokenColor
    public let accentInk: TokenColor
    public let accentOn: TokenColor
    public let focus: TokenColor
    public let accent2: TokenColor
    public let highlight: TokenColor
    public let success: TokenColor
    public let successBg: TokenColor
    public let warn: TokenColor
    public let warnBg: TokenColor
    public let danger: TokenColor
    public let dangerBg: TokenColor
    public let data0: TokenColor
    public let data1: TokenColor
    public let data2: TokenColor
    public let data3: TokenColor
    public let dataAlt: TokenColor
    public let chartGrid: TokenColor
    public let chartLabel: TokenColor
    public let displayWeight: Int
    public let headingWeight: Int
    public let btnWeight: Int
    public let s1: Double
    public let s2: Double
    public let s3: Double
    public let s4: Double
    public let s5: Double
    public let s6: Double
    public let s7: Double
    public let s8: Double
    public let s9: Double
    public let s10: Double
    public let rSm: Double
    public let rMd: Double
    public let rLg: Double
    public let rBtn: Double
    public let e1: TokenShadow
    public let e2: TokenShadow
    public let e3: TokenShadow
    public let dur1: Double
    public let dur2: Double
    public let dur3: Double
    public let dur4: Double
    public let easeStandard: TimingCurve
    public let easeEmph: TimingCurve
    public let easeSpring: TimingCurve
    public let easeEntrance: TimingCurve
    public let easeExit: TimingCurve
    public let easeBack: TimingCurve

    public init(
        bg: TokenColor,
        surface: TokenColor,
        surface2: TokenColor,
        hairlineSoft: TokenColor,
        hairline: TokenColor,
        hairlineStrong: TokenColor,
        text1: TokenColor,
        text2: TokenColor,
        text3: TokenColor,
        accent: TokenColor,
        accentHover: TokenColor,
        accentInk: TokenColor,
        accentOn: TokenColor,
        focus: TokenColor,
        accent2: TokenColor,
        highlight: TokenColor,
        success: TokenColor,
        successBg: TokenColor,
        warn: TokenColor,
        warnBg: TokenColor,
        danger: TokenColor,
        dangerBg: TokenColor,
        data0: TokenColor,
        data1: TokenColor,
        data2: TokenColor,
        data3: TokenColor,
        dataAlt: TokenColor,
        chartGrid: TokenColor,
        chartLabel: TokenColor,
        displayWeight: Int,
        headingWeight: Int,
        btnWeight: Int,
        s1: Double,
        s2: Double,
        s3: Double,
        s4: Double,
        s5: Double,
        s6: Double,
        s7: Double,
        s8: Double,
        s9: Double,
        s10: Double,
        rSm: Double,
        rMd: Double,
        rLg: Double,
        rBtn: Double,
        e1: TokenShadow,
        e2: TokenShadow,
        e3: TokenShadow,
        dur1: Double,
        dur2: Double,
        dur3: Double,
        dur4: Double,
        easeStandard: TimingCurve,
        easeEmph: TimingCurve,
        easeSpring: TimingCurve,
        easeEntrance: TimingCurve,
        easeExit: TimingCurve,
        easeBack: TimingCurve
    ) {
        self.bg = bg
        self.surface = surface
        self.surface2 = surface2
        self.hairlineSoft = hairlineSoft
        self.hairline = hairline
        self.hairlineStrong = hairlineStrong
        self.text1 = text1
        self.text2 = text2
        self.text3 = text3
        self.accent = accent
        self.accentHover = accentHover
        self.accentInk = accentInk
        self.accentOn = accentOn
        self.focus = focus
        self.accent2 = accent2
        self.highlight = highlight
        self.success = success
        self.successBg = successBg
        self.warn = warn
        self.warnBg = warnBg
        self.danger = danger
        self.dangerBg = dangerBg
        self.data0 = data0
        self.data1 = data1
        self.data2 = data2
        self.data3 = data3
        self.dataAlt = dataAlt
        self.chartGrid = chartGrid
        self.chartLabel = chartLabel
        self.displayWeight = displayWeight
        self.headingWeight = headingWeight
        self.btnWeight = btnWeight
        self.s1 = s1
        self.s2 = s2
        self.s3 = s3
        self.s4 = s4
        self.s5 = s5
        self.s6 = s6
        self.s7 = s7
        self.s8 = s8
        self.s9 = s9
        self.s10 = s10
        self.rSm = rSm
        self.rMd = rMd
        self.rLg = rLg
        self.rBtn = rBtn
        self.e1 = e1
        self.e2 = e2
        self.e3 = e3
        self.dur1 = dur1
        self.dur2 = dur2
        self.dur3 = dur3
        self.dur4 = dur4
        self.easeStandard = easeStandard
        self.easeEmph = easeEmph
        self.easeSpring = easeSpring
        self.easeEntrance = easeEntrance
        self.easeExit = easeExit
        self.easeBack = easeBack
    }
}
