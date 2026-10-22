export default async function prepareImage(file, width, height) {
  if (!file || !file.type.startsWith('image/')) {
    throw new Error('Iltimos, rasm faylini tanlang.');
  }

  let source;
  let releaseSource;

  try {
    if (typeof createImageBitmap === 'function') {
      source = await createImageBitmap(file);
      releaseSource = () => source.close();
    } else {
      const imageUrl = URL.createObjectURL(file);
      const image = new Image();
      releaseSource = () => URL.revokeObjectURL(imageUrl);
      image.src = imageUrl;
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = () => reject(new Error('Rasmni ochib bo‘lmadi. Boshqa rasmni tanlang.'));
      });
      source = image;
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Rasmni qayta ishlash uchun canvas ochilmadi.');

    const scale = Math.max(width / source.width, height / source.height);
    const cropWidth = width / scale;
    const cropHeight = height / scale;
    const cropX = (source.width - cropWidth) / 2;
    const cropY = (source.height - cropHeight) / 2;

    context.drawImage(source, cropX, cropY, cropWidth, cropHeight, 0, 0, width, height);
    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (result) => result ? resolve(result) : reject(new Error('WEBP rasm yaratilmadi. Boshqa rasmni tanlang.')),
        'image/webp',
        0.88,
      );
    });
    if (blob.type !== 'image/webp') {
      throw new Error('Brauzer WEBP formatini yaratishni qo‘llab-quvvatlamaydi.');
    }

    const name = file.name.replace(/\.[^.]+$/, '') || 'image';
    return new File([blob], `${name}.webp`, { type: 'image/webp', lastModified: Date.now() });
  } finally {
    releaseSource?.();
  }
}
