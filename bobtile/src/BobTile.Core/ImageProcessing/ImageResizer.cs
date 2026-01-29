using SkiaSharp;

namespace BobTile.Core.ImageProcessing;

public static class ImageResizer
{
    public static SKBitmap ResizeNearestNeighbor(SKBitmap source, int targetWidth, int targetHeight)
    {
        var resized = new SKBitmap(targetWidth, targetHeight, source.ColorType, source.AlphaType);

        using var canvas = new SKCanvas(resized);
        using var paint = new SKPaint
        {
            FilterQuality = SKFilterQuality.None,
            IsAntialias = false
        };

        var destRect = new SKRect(0, 0, targetWidth, targetHeight);
        canvas.DrawBitmap(source, destRect, paint);

        return resized;
    }
}
