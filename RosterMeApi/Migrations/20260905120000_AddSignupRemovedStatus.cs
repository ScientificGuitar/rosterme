using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RosterMeApi.Migrations
{
    /// <inheritdoc />
    public partial class AddSignupRemovedStatus : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Signups_Email_TimeSlotId",
                table: "Signups");

            migrationBuilder.CreateIndex(
                name: "IX_Signups_Email_TimeSlotId",
                table: "Signups",
                columns: new[] { "Email", "TimeSlotId" },
                unique: true,
                filter: "\"Status\" <> 'Cancelled' AND \"Status\" <> 'Removed'");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Signups_Email_TimeSlotId",
                table: "Signups");

            migrationBuilder.CreateIndex(
                name: "IX_Signups_Email_TimeSlotId",
                table: "Signups",
                columns: new[] { "Email", "TimeSlotId" },
                unique: true,
                filter: "\"Status\" <> 'Cancelled'");
        }
    }
}
