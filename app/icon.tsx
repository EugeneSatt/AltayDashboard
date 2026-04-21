import { ImageResponse } from 'next/og';

export const size = {
  width: 64,
  height: 64
};

export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background:
            'linear-gradient(135deg, rgb(184, 92, 56), rgb(36, 106, 115))',
          color: 'white',
          fontSize: 28,
          fontWeight: 800,
          letterSpacing: -1
        }}
      >
        MD
      </div>
    ),
    size
  );
}
