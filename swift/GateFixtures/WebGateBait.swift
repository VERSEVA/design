// GATE FIXTURE. Not part of the Swift package build.
// Holds a raw hex and a raw size on purpose: the web gates (hex, contrast,
// spacing, type) must skip everything under swift/. Held in place by
// test/swift-ignored.test.mjs. Do not "fix" the literals.
import SwiftUI

enum WebGateBait {
    static let hex = "#c0ffee"
    static let size: CGFloat = 13
}
