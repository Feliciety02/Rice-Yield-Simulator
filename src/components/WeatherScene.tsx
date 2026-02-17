import { useMemo } from 'react';
import { motion } from 'framer-motion';
import type { WeatherType } from '@/lib/simulation';

interface WeatherSceneProps {
  weather: WeatherType | null;
  growthProgress: number; // 0-1
}

const RainDrops = () => {
  const drops = useMemo(
    () =>
      Array.from({ length: 60 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 2,
        duration: 0.5 + Math.random() * 0.5,
        opacity: 0.3 + Math.random() * 0.5,
      })),
    []
  );
  return (
    <>
      {drops.map((d) => (
        <div
          key={d.id}
          className="rain-drop absolute w-[2px] h-4 bg-rain rounded-full"
          style={{
            left: `${d.left}%`,
            top: -20,
            animationDelay: `${d.delay}s`,
            animationDuration: `${d.duration}s`,
            opacity: d.opacity,
          }}
        />
      ))}
    </>
  );
};

const Clouds = ({ dark }: { dark?: boolean }) => (
  <div className="absolute top-4 left-0 w-full overflow-hidden h-24 pointer-events-none">
    {[0, 1, 2].map((i) => (
      <div
        key={i}
        className={`cloud-move absolute rounded-full ${dark ? 'bg-sky_storm' : 'bg-muted/60'}`}
        style={{
          width: 120 + i * 40,
          height: 40 + i * 10,
          top: i * 20,
          animationDelay: `${i * 7}s`,
          filter: dark ? 'brightness(0.5)' : 'none',
        }}
      />
    ))}
  </div>
);

const Sun = () => (
  <div className="sun-glow absolute top-6 right-12 w-16 h-16 rounded-full bg-sun" />
);

const RiceStalks = ({
  progress,
  strong,
}: {
  progress: number;
  strong?: boolean;
}) => {
  const stalks = useMemo(
    () =>
      Array.from({ length: 20 }, (_, i) => ({
        id: i,
        left: 5 + (i / 20) * 90,
        height: 30 + progress * 70,
      })),
    [progress]
  );

  return (
    <div className="absolute bottom-0 left-0 w-full h-32">
      {stalks.map((s) => (
        <div
          key={s.id}
          className={strong ? 'rice-sway-strong' : 'rice-sway'}
          style={{
            position: 'absolute',
            left: `${s.left}%`,
            bottom: 0,
            width: 4,
            height: s.height,
            background: `linear-gradient(to top, hsl(var(--earth)), hsl(var(--field-green)))`,
            borderRadius: '2px 2px 0 0',
          }}
        >
          {progress > 0.6 && (
            <div
              className="absolute -top-2 -left-2 w-8 h-4 rounded-full"
              style={{
                background: `hsl(var(--field-green))`,
                opacity: 0.7,
              }}
            />
          )}
        </div>
      ))}
    </div>
  );
};

const skyColors: Record<WeatherType, string> = {
  Dry: 'from-sky_clear via-sun/20 to-secondary',
  Normal: 'from-sky_cloudy via-muted to-secondary',
  Wet: 'from-sky_cloudy via-rain/20 to-muted',
  Typhoon: 'from-sky_storm via-sky_storm to-muted',
};

export default function WeatherScene({ weather, growthProgress }: WeatherSceneProps) {
  const w = weather ?? 'Normal';

  return (
    <motion.div
      className={`relative w-full h-64 rounded-lg overflow-hidden bg-gradient-to-b ${skyColors[w]}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      {(w === 'Dry' || w === 'Normal') && <Sun />}
      {(w === 'Normal' || w === 'Wet') && <Clouds />}
      {w === 'Typhoon' && <Clouds dark />}
      {(w === 'Wet' || w === 'Typhoon') && <RainDrops />}

      {/* Ground */}
      <div
        className="absolute bottom-0 left-0 w-full h-16"
        style={{
          background:
            w === 'Dry'
              ? `hsl(var(--field-dry))`
              : `hsl(var(--earth))`,
        }}
      />

      <RiceStalks progress={growthProgress} strong={w === 'Typhoon'} />

      {/* Weather label */}
      <div className="absolute top-3 left-3 px-3 py-1 rounded-full bg-background/70 backdrop-blur text-xs font-semibold text-foreground">
        {w} {w === 'Typhoon' && '🌀'} {w === 'Dry' && '☀️'} {w === 'Wet' && '🌧️'} {w === 'Normal' && '⛅'}
      </div>
    </motion.div>
  );
}
