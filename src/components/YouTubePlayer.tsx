import { useEffect, useRef } from 'react';

interface YouTubePlayerProps {
  videoId: string;
  autoplay?: boolean;
  mute?: boolean;
  controls?: boolean;
}

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

export const YouTubePlayer = ({ 
  videoId, 
  autoplay = true, 
  mute = true, 
  controls = false 
}: YouTubePlayerProps) => {
  const playerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Load YouTube IFrame API script
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
    }

    // Initialize player when API is ready
    const initPlayer = () => {
      if (window.YT && window.YT.Player) {
        playerRef.current = new window.YT.Player(containerRef.current, {
          videoId: videoId,
          playerVars: {
            autoplay: autoplay ? 1 : 0,
            mute: mute ? 1 : 0,
            controls: controls ? 1 : 0,
            enablejsapi: 1,
            rel: 0,
          },
          events: {
            onStateChange: (event: any) => {
              // Loop video manually when it ends
              if (event.data === window.YT.PlayerState.ENDED) {
                playerRef.current.playVideo();
              }
            },
          },
        });
      }
    };

    if (window.YT && window.YT.Player) {
      initPlayer();
    } else {
      window.onYouTubeIframeAPIReady = initPlayer;
    }

    // Cleanup
    return () => {
      if (playerRef.current && playerRef.current.destroy) {
        playerRef.current.destroy();
      }
    };
  }, [videoId, autoplay, mute, controls]);

  return (
    <div 
      style={{ 
        position: 'relative', 
        paddingBottom: '56.25%', 
        height: 0, 
        overflow: 'hidden', 
        maxWidth: '100%' 
      }}
      className="rounded-2xl shadow-xl"
    >
      <div 
        ref={containerRef}
        style={{ 
          position: 'absolute', 
          top: 0, 
          left: 0, 
          width: '100%', 
          height: '100%' 
        }}
      />
    </div>
  );
};
