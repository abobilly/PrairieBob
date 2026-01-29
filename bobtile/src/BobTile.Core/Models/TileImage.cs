using SkiaSharp;

namespace BobTile.Core.Models;

public sealed class TileImage : IDisposable
{
    public string FilePath { get; }
    public string FileName { get; }
    public int Width { get; }
    public int Height { get; }
    public SKBitmap Bitmap { get; }

    public TileImage(string filePath, SKBitmap bitmap)
    {
        FilePath = filePath;
        FileName = Path.GetFileName(filePath);
        Width = bitmap.Width;
        Height = bitmap.Height;
        Bitmap = bitmap;
    }

    public void Dispose()
    {
        Bitmap.Dispose();
    }
}
