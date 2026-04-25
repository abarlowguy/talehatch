"use client";

import { useState, useEffect, useRef } from "react";

const POLLINATIONS_URL = "https://image.pollinations.ai/prompt/" +
  encodeURIComponent("A girl with dark hair standing before a glowing ancient iron gate at the edge of a mysterious forest, warm golden light emanating from the gate's ironwork, dramatic atmospheric lighting, misty treeline beyond, children's book illustration, watercolour and ink, warm and magical, highly detailed") +
  "?width=768&height=768&model=flux&seed=317842";

const PROXY_URL = `/api/image-proxy?url=${encodeURIComponent(POLLINATIONS_URL)}`;

export default function TestChapterPage() {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (imageLoaded) return;
    const start = Date.now();
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 500);
    return () => clearInterval(t);
  }, [imageLoaded]);

  useEffect(() => {
    if (imgRef.current?.complete && imgRef.current.naturalWidth > 0) {
      setImageLoaded(true);
    }
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">

        <div className="bg-amber-100 border border-amber-300 rounded-xl px-4 py-2 text-center text-sm text-amber-800 font-medium">
          TEST PAGE — The Whispering Gate
        </div>

        {/* Image */}
        <div className="w-full rounded-2xl overflow-hidden shadow-lg bg-slate-200">
          {!imageLoaded && !imageError && (
            <div className="w-full aspect-video flex flex-col items-center justify-center gap-2 text-slate-400 text-sm">
              <div className="flex gap-1">
                {[0,1,2].map(i => (
                  <div key={i} className="w-2 h-2 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
                ))}
              </div>
              <p>Painting your illustration… {elapsed}s</p>
            </div>
          )}
          {imageError && (
            <div className="w-full aspect-video flex items-center justify-center text-slate-400 text-sm italic">
              Illustration unavailable
            </div>
          )}
          <img
            ref={imgRef}
            src={PROXY_URL}
            alt="Chapter illustration"
            style={{ opacity: imageLoaded ? 1 : 0, transition: "opacity 0.5s", display: "block" }}
            className="w-full"
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageError(true)}
          />
        </div>

        {/* Title */}
        <div className="text-center space-y-1">
          <p className="text-xs font-semibold text-amber-600 tracking-widest uppercase">Chapter 1</p>
          <h1 className="text-3xl font-bold text-slate-800">The Whispering Gate</h1>
          <p className="text-slate-500 text-sm">by Hayley Barlow</p>
        </div>

        {/* Chapter text */}
        <div className="bg-white rounded-2xl shadow p-8">
          <p className="font-serif text-lg leading-relaxed text-slate-800 whitespace-pre-wrap">{`Mira had never seen the old gate glow before.

She stood at the edge of Hollow Creek, her boots sinking slightly into the mud, staring at the rusted iron archway that marked the boundary between town and the Greywood. Every kid in Millhaven knew you didn't go past the gate after dark. But it wasn't dark — it was barely past noon — and the gate was humming.

Not a sound, exactly. More like a pressure behind her ears, the way the air feels before a thunderstorm swallows the sky. The iron scrollwork shimmered faintly gold, then copper, then a color she didn't have a name for.

She took a step closer.

Behind her, the creek burbled on, indifferent. A crow launched itself from a dead oak and screamed once before vanishing into the canopy. Mira didn't flinch. She had spent three years learning not to flinch — three years since her brother Callum walked into the Greywood on a Tuesday morning and never came back.

The investigators said he must have fallen into the ravine. Her parents eventually agreed, because agreeing was easier than the alternative. But Mira had found his compass on the kitchen table the morning he disappeared. Callum never went anywhere without his compass.

She pulled it from her jacket pocket now. The needle spun lazily, uselessly — it had done that ever since she found it. Except now, as she drew within arm's reach of the gate, the needle stopped.

It pointed straight into the Greywood.

Mira pressed her palm flat against the iron. The metal was warm. Not sun-warm — warm the way a living thing is warm. She felt the hum travel up through her hand, her arm, settling into her chest like a second heartbeat.

The gate swung open.

Not with a creak, not with any of the protest you'd expect from something that hadn't moved in years. It opened the way a door opens when someone on the other side is already turning the handle.

The path beyond looked ordinary: packed earth, tree roots, the particular greenish dark of old forest. But the air that rolled out was different. It smelled like rain that hadn't fallen yet, like library books, like the specific cold of a room no one had been inside for a very long time.

Mira looked back at the town. Mrs. Aldren's washing snapped on the line. A delivery truck rumbled down Main Street. Everything ordinary and impossible and miles away.

She looked at the compass. Still pointing forward.

She stepped through the gate.

The moment both feet crossed the threshold, the humming stopped. The Greywood was completely, totally, pressingly silent — the kind of silence that isn't empty but full, packed tight with something listening.

Then, from somewhere deeper in the trees, came the sound of a boy's voice.

It said her name.

And when she spun toward it, she saw that the gate behind her was gone.`}</p>
        </div>

      </div>
    </div>
  );
}
