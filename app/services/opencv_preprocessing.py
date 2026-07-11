from __future__ import annotations

from pathlib import Path

import cv2


def preprocess_accident_image(path: Path, *, max_width: int = 1600) -> bytes:
    image = cv2.imread(str(path))
    if image is None:
        raise ValueError(f"Unable to read image for preprocessing: {path}")

    height, width = image.shape[:2]
    if width > max_width:
        ratio = max_width / float(width)
        image = cv2.resize(image, (max_width, int(height * ratio)), interpolation=cv2.INTER_AREA)

    denoised = cv2.fastNlMeansDenoisingColored(image, None, 6, 6, 7, 21)
    lab = cv2.cvtColor(denoised, cv2.COLOR_BGR2LAB)
    lightness, a_channel, b_channel = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    enhanced_lightness = clahe.apply(lightness)
    enhanced = cv2.merge((enhanced_lightness, a_channel, b_channel))
    enhanced = cv2.cvtColor(enhanced, cv2.COLOR_LAB2BGR)

    ok, buffer = cv2.imencode(".jpg", enhanced, [int(cv2.IMWRITE_JPEG_QUALITY), 92])
    if not ok:
        raise ValueError("OpenCV failed to encode preprocessed image.")
    return buffer.tobytes()
