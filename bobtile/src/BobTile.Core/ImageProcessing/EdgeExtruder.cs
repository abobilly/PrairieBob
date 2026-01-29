using SkiaSharp;

namespace BobTile.Core.ImageProcessing;

public static class EdgeExtruder
{
    public static void ExtrudeEdges(SKCanvas canvas, SKBitmap tile, int tileX, int tileY)
    {
        int w = tile.Width;
        int h = tile.Height;

        // Left edge: copy column 0 to x-1
        for (int row = 0; row < h; row++)
        {
            var pixel = tile.GetPixel(0, row);
            canvas.DrawPoint(tileX - 1, tileY + row, new SKPaint { Color = pixel });
        }

        // Right edge: copy column (w-1) to x+w
        for (int row = 0; row < h; row++)
        {
            var pixel = tile.GetPixel(w - 1, row);
            canvas.DrawPoint(tileX + w, tileY + row, new SKPaint { Color = pixel });
        }

        // Top edge: copy row 0 to y-1
        for (int col = 0; col < w; col++)
        {
            var pixel = tile.GetPixel(col, 0);
            canvas.DrawPoint(tileX + col, tileY - 1, new SKPaint { Color = pixel });
        }

        // Bottom edge: copy row (h-1) to y+h
        for (int col = 0; col < w; col++)
        {
            var pixel = tile.GetPixel(col, h - 1);
            canvas.DrawPoint(tileX + col, tileY + h, new SKPaint { Color = pixel });
        }

        // Corners
        using var paint = new SKPaint();

        // Top-left
        paint.Color = tile.GetPixel(0, 0);
        canvas.DrawPoint(tileX - 1, tileY - 1, paint);

        // Top-right
        paint.Color = tile.GetPixel(w - 1, 0);
        canvas.DrawPoint(tileX + w, tileY - 1, paint);

        // Bottom-left
        paint.Color = tile.GetPixel(0, h - 1);
        canvas.DrawPoint(tileX - 1, tileY + h, paint);

        // Bottom-right
        paint.Color = tile.GetPixel(w - 1, h - 1);
        canvas.DrawPoint(tileX + w, tileY + h, paint);
    }
}
