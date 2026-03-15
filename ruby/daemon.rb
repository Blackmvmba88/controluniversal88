#!/usr/bin/env ruby
# frozen_string_literal: true

require 'json'

# ControlUniversal Ruby Daemon - The "Wow Factor" Edition
# Transform your DualShock 4 into a system-wide macro controller.
class Daemon
  attr_accessor :command_map

  def initialize
    @simulate = ENV['SIMULATE'] == '1'
    @running = false
    # Mapeo de "Wow Factor": Botón -> Comando de macOS
    @command_map = {
      'triangle' => 'say "System override engaged. Hello Iyari."',
      'circle'   => 'open https://github.com/Blackmvmba88/controluniversal88',
      'square'   => 'open -a Calculator',
      'ps'       => 'say "Control Universal is alive"'
    }
    puts "🚀 Wow Factor Daemon initialized (darwin mode)"
  end

  def start(&block)
    @running = true
    @callback = block

    puts "🎮 Monitoring inputs..."
    if @simulate
      simulate_input
    else
      # Aquí iría la conexión real con ffi-hidapi
      puts "⚠️ Real HID hardware requires 'ffi-hidapi' gem."
      puts "Falling back to simulation for safety..."
      simulate_input
    end
  end

  def stop
    @running = false
  end

  private

  def simulate_input
    Thread.new do
      buttons = %w[cross circle square triangle l1 r1 ps]
      while @running
        sleep (2 + rand(5)) # No queremos que sea un caos, cada 2-7 segundos
        
        btn = buttons.sample
        val = 1 # Simulamos el press
        
        event = {
          type: 'button',
          id: btn,
          value: val,
          timestamp: Time.now.to_i,
          origin: 'ruby-engine'
        }

        # El Wow Factor: Ejecutar comando si existe en el mapa
        if @command_map[btn]
          puts "🔥 TRIGERED: Button #{btn} executing: #{@command_map[btn]}"
          system(@command_map[btn]) # <--- AQUÍ PASA LA MAGIA
        end

        @callback&.call(event)
        
        # Simular liberación rápido
        sleep 0.2
        @callback&.call(event.merge(value: 0))
      end
    end
  end
end

if __FILE__ == $PROGRAM_NAME
  daemon = Daemon.new
  daemon.start { |e| puts "Event: #{e[:id]} = #{e[:value]}" }
  sleep
end
