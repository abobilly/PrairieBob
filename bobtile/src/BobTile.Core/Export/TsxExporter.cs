using System.Text;

namespace BobTile.Core.Export;

public static class TsxExporter
{
    public static void Export(
        string outputPath,
        string imageFilename,
        int tileWidth,
        int tileHeight,
        int tileCount,
        int columns,
        int imageWidth,
        int imageHeight)
    {
        string tilesetName = Path.GetFileNameWithoutExtension(imageFilename);

        var sb = new StringBuilder();
        sb.AppendLine("<?xml version=\"1.0\" encoding=\"UTF-8\"?>");
        sb.Append($"<tileset version=\"1.10\" tiledversion=\"1.11.0\" ");
        sb.Append($"name=\"{tilesetName}\" ");
        sb.Append($"tilewidth=\"{tileWidth}\" ");
        sb.Append($"tileheight=\"{tileHeight}\" ");
        sb.Append($"tilecount=\"{tileCount}\" ");
        sb.AppendLine($"columns=\"{columns}\">");
        sb.Append($"  <image source=\"{imageFilename}\" ");
        sb.Append($"width=\"{imageWidth}\" ");
        sb.AppendLine($"height=\"{imageHeight}\"/>");
        sb.AppendLine("</tileset>");

        File.WriteAllText(outputPath, sb.ToString(), Encoding.UTF8);
    }
}
