require 'json'

package = JSON.parse(File.read(File.join(__dir__, 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'ExpoLiveActivity'
  s.version        = package['version']
  s.summary        = package['description']
  s.author         = 'Moraki'
  s.homepage       = 'https://moraki.app'
  # 16.1, not 16.2: the module's own start/update/end need 16.2 (see
  # ios/LiveActivityModule.swift), but they're #available-guarded and
  # correctly report unavailable below it, so this stays the app's own
  # deployment target rather than silently raising the whole app's
  # minimum supported iOS version for one optional feature.
  s.platforms      = { ios: '16.1' }
  s.source         = { git: '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.swift_version  = '5.9'
  # ios/widget/** is the widget extension's own view, not this module's —
  # it belongs to a separate Xcode target that doesn't exist yet (README.md).
  s.source_files   = 'ios/*.{h,m,swift}'
end
