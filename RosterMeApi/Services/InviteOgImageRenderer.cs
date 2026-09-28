using SkiaSharp;

namespace RosterMeApi.Services;

/// <summary>
/// Renders the per-invite 1200x630 preview image (event title, group, date).
/// Pure raster drawing via SkiaSharp — no browser or native screenshot tooling.
/// If no system font is available the text falls back to Skia's default
/// typeface; rendering never throws for font reasons.
/// </summary>
public static class InviteOgImageRenderer
{
    private const int Width = 1200;
    private const int Height = 630;
    private const int Padding = 96;
    private const int MaxTitleLines = 3;

    public static byte[] Render(InviteUnfurlData data)
    {
        using var surface = SKSurface.Create(new SKImageInfo(Width, Height));
        var canvas = surface.Canvas;

        PaintBackground(canvas);

        var title = InviteUnfurlBuilder.Truncate(data.EventTitle, 90);
        var subtitle = InviteUnfurlBuilder.Truncate(
            $"{data.GroupName} · {InviteUnfurlBuilder.FormatDate(data.EventDate)}", 90);

        using var brandTypeface = LoadTypeface(bold: true);
        using var brandPaint = new SKPaint
        {
            Typeface = brandTypeface,
            TextSize = 34,
            Color = new SKColor(0xA5, 0xB4, 0xFC),
            IsAntialias = true,
        };
        canvas.DrawText("ROSTERME · VOLUNTEER SIGNUP", Padding, 150, brandPaint);

        using var titleTypeface = LoadTypeface(bold: true);
        using var titlePaint = new SKPaint
        {
            Typeface = titleTypeface,
            TextSize = 84,
            Color = SKColors.White,
            IsAntialias = true,
        };
        var titleLines = WrapText(title, titlePaint, Width - Padding * 2, MaxTitleLines);
        const float TitleStartY = 262;
        const float TitleLineHeight = 96;
        var y = TitleStartY;
        foreach (var line in titleLines)
        {
            canvas.DrawText(line, Padding, y, titlePaint);
            y += TitleLineHeight;
        }
        var lastTitleBaseline = y - TitleLineHeight;

        using var subTypeface = LoadTypeface(bold: false);
        using var subPaint = new SKPaint
        {
            Typeface = subTypeface,
            TextSize = 44,
            Color = new SKColor(0xD4, 0xD4, 0xD8),
            IsAntialias = true,
        };
        var maxTextWidth = Width - Padding * 2;
        var fittedSubtitle = subPaint.MeasureText(subtitle) <= maxTextWidth
            ? subtitle
            : Ellipsize(subtitle, subPaint, maxTextWidth);
        canvas.DrawText(fittedSubtitle, Padding, lastTitleBaseline + 76, subPaint);

        using var footTypeface = LoadTypeface(bold: false);
        using var footPaint = new SKPaint
        {
            Typeface = footTypeface,
            TextSize = 30,
            Color = new SKColor(0xA1, 0xA1, 0xAA),
            IsAntialias = true,
        };
        canvas.DrawText("rosterme.app", Padding, Height - 46, footPaint);

        using var image = surface.Snapshot();
        using var encoded = image.Encode(SKEncodedImageFormat.Png, 90);
        return encoded.ToArray();
    }

    private static void PaintBackground(SKCanvas canvas)
    {
        using var bg = new SKPaint
        {
            Shader = SKShader.CreateLinearGradient(
                new SKPoint(0, 0),
                new SKPoint(Width, Height),
                [new SKColor(0x27, 0x27, 0x2E), new SKColor(0x18, 0x18, 0x1B)],
                null,
                SKShaderTileMode.Clamp),
        };
        canvas.DrawRect(new SKRect(0, 0, Width, Height), bg);

        // Indigo accent strip along the top.
        using var accent = new SKPaint { Color = new SKColor(0x63, 0x66, 0xF1) };
        canvas.DrawRect(new SKRect(0, 0, Width, 14), accent);

        // Soft decorative disc, bottom-right.
        using var disc = new SKPaint
        {
            Color = new SKColor(0x63, 0x66, 0xF1, 38),
            IsAntialias = true,
        };
        canvas.DrawCircle(Width - 60, Height + 120, 340, disc);
    }

    private static SKTypeface? LoadTypeface(bool bold)
    {
        try
        {
            var weight = bold ? SKFontStyleWeight.Bold : SKFontStyleWeight.Normal;
            return SKTypeface.FromFamilyName("DejaVu Sans", weight, SKFontStyleWidth.Normal, SKFontStyleSlant.Upright)
                ?? SKTypeface.Default;
        }
        catch
        {
            return null;
        }
    }

    internal static List<string> WrapText(string text, SKPaint paint, float maxWidth, int maxLines)
    {
        var words = text.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        var lines = new List<string>();
        var current = "";

        foreach (var word in words)
        {
            // A single word wider than the canvas gets hard-clipped char by char.
            var token = paint.MeasureText(word) > maxWidth && current.Length == 0
                ? ClipToWidth(word, paint, maxWidth)
                : word;
            var candidate = current.Length == 0 ? token : current + " " + token;
            if (paint.MeasureText(candidate) <= maxWidth)
            {
                current = candidate;
            }
            else
            {
                lines.Add(current);
                if (lines.Count == maxLines)
                {
                    current = string.Empty;
                    break;
                }
                current = token;
            }
        }

        if (current.Length > 0 && lines.Count < maxLines)
            lines.Add(current);

        // Overflow: more words remain than fit in maxLines.
        if (lines.Count == maxLines && current.Length == 0)
            lines[^1] = Ellipsize(lines[^1], paint, maxWidth);

        return lines.Count == 0 ? [""] : lines;
    }

    private static string ClipToWidth(string word, SKPaint paint, float maxWidth)
    {
        var end = word.Length;
        while (end > 1 && paint.MeasureText(word[..end]) > maxWidth)
            end--;
        return word[..end];
    }

    private static string Ellipsize(string line, SKPaint paint, float maxWidth)
    {
        var candidate = line.TrimEnd() + "…";
        while (candidate.Length > 1 && paint.MeasureText(candidate) > maxWidth)
            candidate = candidate[..^2].TrimEnd() + "…";
        return candidate;
    }
}
