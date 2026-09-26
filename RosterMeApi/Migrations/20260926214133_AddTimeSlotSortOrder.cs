using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RosterMeApi.Migrations
{
    /// <inheritdoc />
    public partial class AddTimeSlotSortOrder : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "SortOrder",
                table: "TimeSlots",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            // Backfill existing rows so each event's slots keep the order they
            // were previously displayed in (earliest start time first). Ties
            // fall back to creation order then id for stability.
            migrationBuilder.Sql("""
                UPDATE "TimeSlots" AS t
                SET "SortOrder" = ranked.rn
                FROM (
                    SELECT "Id",
                           ROW_NUMBER() OVER (PARTITION BY "EventId" ORDER BY "StartTime", "CreatedAt", "Id") - 1 AS rn
                    FROM "TimeSlots"
                ) AS ranked
                WHERE t."Id" = ranked."Id";
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "SortOrder",
                table: "TimeSlots");
        }
    }
}
