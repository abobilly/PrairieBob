using BobTile.Core.Models;
using BobTile.Core.Sorting;
using SkiaSharp;

namespace BobTile.Core.ImageProcessing;

public static class ImageLoader
{
    private static readonly string[] SupportedExtensions = { ".png", ".webp" };

    public static TileImage LoadImage(string filePath)
    {
        using var stream = File.OpenRead(filePath);
        var bitmap = SKBitmap.Decode(stream);
        if (bitmap == null)
        {
            throw new InvalidOperationException($"Failed to decode image: {filePath}");
        }
        return new TileImage(filePath, bitmap);
    }

    public static List<string> GetImagesFromFolder(string folderPath)
    {
        var files = Directory.EnumerateFiles(folderPath)
            .Where(f => SupportedExtensions.Contains(Path.GetExtension(f).ToLowerInvariant()))
            .ToList();

        files.Sort(NaturalSortComparer.Instance);
        return files;
    }

    public static List<string> SortFiles(IEnumerable<string> files)
    {
        var sorted = files.ToList();
        sorted.Sort(NaturalSortComparer.Instance);
        return sorted;
    }
}
