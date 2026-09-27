require 'json'

package = JSON.parse(File.read(File.join(__dir__, 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'ExpoHomeWidget'
  s.version        = package['version']
  s.summary        = package['description']
  s.author         = 'Moraki'
  s.homepage       = 'https://moraki.app'
  s.platforms      = { ios: '16.1' }
  s.source         = { git: '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.swift_version  = '5.9'
  # ios/widget/** is the widget extension's own view, not this module's —
  # it belongs to a separate Xcode target that doesn't exist yet (README.md).
  s.source_files   = 'ios/*.{h,m,swift}'
end
