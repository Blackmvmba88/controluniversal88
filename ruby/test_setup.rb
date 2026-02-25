#!/usr/bin/env ruby
# frozen_string_literal: true

# Simple test to verify ryby gem is installed and accessible

puts "=== Ruby ControlUniversal - Gem Verification ==="
puts ""
puts "Ruby Version: #{RUBY_VERSION}"
puts ""

# Check if ryby gem is installed
begin
  gem 'ryby', '>= 0.1.2'
  puts "✓ ryby gem is installed (version #{Gem.loaded_specs['ryby'].version})"
rescue Gem::LoadError
  puts "✗ ryby gem is NOT installed"
  exit 1
end

# Check other required gems
required_gems = %w[sinatra puma faye-websocket]
required_gems.each do |gem_name|
  begin
    gem gem_name
    puts "✓ #{gem_name} gem is installed (version #{Gem.loaded_specs[gem_name].version})"
  rescue Gem::LoadError
    puts "✗ #{gem_name} gem is NOT installed"
  end
end

puts ""
puts "=== All required gems are present ==="
puts ""
puts "You can now run:"
puts "  SIMULATE=1 bundle exec ruby ruby/server.rb"
puts ""
puts "Then open http://localhost:8080 in your browser"
