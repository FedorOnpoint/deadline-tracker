import { useState } from 'react';

export function UserAvatar({ name, src }: { name: string; src?: string }) {
  const [failedURL, setFailedURL] = useState('');
  return (
    <span className="user-avatar" aria-hidden="true">
      {src && src !== failedURL ? (
        <img src={src} alt="" onError={() => setFailedURL(src)} />
      ) : (
        name.slice(0, 1)
      )}
    </span>
  );
}
