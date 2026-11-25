// WHERE EACH PORTRAIT'S FACE IS, for the app to show every portrait the same way (src/imgnorm.js). A browser cannot find a
// face, so the Mac's own face finder (Vision) reads each picture in public/<world>/players once, and the answers go in
// src/data/faces.json: "<world>/<name>": [centre x, centre y, width], fractions of the picture. Run it after adding or
// replacing a portrait:
//
//   swift test/faces.swift
//
// A picture whose face is not found is left out, and the app shows it as it is.
import Foundation
import ImageIO
import Vision

let root = URL(fileURLWithPath: CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : FileManager.default.currentDirectoryPath)
let pub = root.appendingPathComponent("public"), fm = FileManager.default
var out: [String: [Double]] = [:], missed: [String] = []
for world in (try? fm.contentsOfDirectory(atPath: pub.path)) ?? [] {
  let dir = pub.appendingPathComponent(world).appendingPathComponent("players")
  guard let files = try? fm.contentsOfDirectory(atPath: dir.path) else { continue }
  for f in files.sorted() where f.lowercased().hasSuffix(".png") {
    let name = (f as NSString).deletingPathExtension.precomposedStringWithCanonicalMapping
    guard let src = CGImageSourceCreateWithURL(dir.appendingPathComponent(f) as CFURL, nil),
          let im = CGImageSourceCreateImageAtIndex(src, 0, nil) else { missed.append(name); continue }
    let req = VNDetectFaceRectanglesRequest()
    try? VNImageRequestHandler(cgImage: im).perform([req])
    // the biggest face is his; Vision measures from the bottom left, the app from the top left
    guard let bb = (req.results ?? []).max(by: { $0.boundingBox.width < $1.boundingBox.width })?.boundingBox else { missed.append(name); continue }
    let r = { (x: Double) in (x * 10000).rounded() / 10000 }
    out[world + "/" + name] = [r(Double(bb.midX)), r(Double(1 - bb.midY)), r(Double(bb.width))]
  }
}
let keys = out.keys.sorted()
let body = keys.map { k -> String in
  let v = out[k]!
  let key = String(data: try! JSONSerialization.data(withJSONObject: [k], options: [.withoutEscapingSlashes]), encoding: .utf8)!.dropFirst().dropLast()
  return "\(key):[\(v[0]),\(v[1]),\(v[2])]"
}
let text = "{\n" + body.joined(separator: ",\n") + "\n}\n"
try! text.write(to: root.appendingPathComponent("src/data/faces.json"), atomically: true, encoding: .utf8)
print("faces:", out.count, missed.isEmpty ? "" : "| not found: " + missed.joined(separator: ", "))
