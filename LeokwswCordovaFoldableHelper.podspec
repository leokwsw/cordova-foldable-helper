require 'json'

package = JSON.parse(File.read(File.join(__dir__, 'package.json')))

Pod::Spec.new do |spec|
  spec.name = 'LeokwswCordovaFoldableHelper'
  spec.version = package['version']
  spec.summary = package['description']
  spec.license = { :type => 'MIT', :file => 'LICENSE' }
  spec.homepage = 'https://www.npmjs.com/package/@leokwsw/cordova-foldable-helper'
  spec.author = 'Leo Wu'
  spec.source = { :http => "https://registry.npmjs.org/#{package['name']}/-/#{package['name'].split('/').last}-#{spec.version}.tgz" }
  spec.source_files = 'ios/Sources/FoldableLayoutPlugin/*.swift'
  spec.ios.deployment_target = '15.0'
  spec.dependency 'Capacitor', '~> 8.0'
  spec.swift_version = '5.0'
end
