using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RosterMeApi.Migrations
{
    /// <inheritdoc />
    public partial class AddEmailConfirmationToSignup : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "ConfirmedAt",
                table: "Signups",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Email",
                table: "Signups",
                type: "character varying(320)",
                maxLength: 320,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "ManagementTokenHash",
                table: "Signups",
                type: "character varying(64)",
                maxLength: 64,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Status",
                table: "Signups",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "Confirmed");

            migrationBuilder.CreateTable(
                name: "EmailMessages",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    To = table.Column<string>(type: "character varying(320)", maxLength: 320, nullable: false),
                    Subject = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    HtmlBody = table.Column<string>(type: "text", nullable: false),
                    TextBody = table.Column<string>(type: "text", nullable: true),
                    Sent = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    SentAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EmailMessages", x => x.Id);
                });

            migrationBuilder.Sql("""
                UPDATE "Signups"
                SET "ManagementTokenHash" = md5("Id"::text)
                WHERE "ManagementTokenHash" = ''
                """);

            migrationBuilder.CreateIndex(
                name: "IX_Signups_ManagementTokenHash",
                table: "Signups",
                column: "ManagementTokenHash",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_EmailMessages_Sent",
                table: "EmailMessages",
                column: "Sent");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "EmailMessages");

            migrationBuilder.DropIndex(
                name: "IX_Signups_ManagementTokenHash",
                table: "Signups");

            migrationBuilder.DropColumn(
                name: "ConfirmedAt",
                table: "Signups");

            migrationBuilder.DropColumn(
                name: "Email",
                table: "Signups");

            migrationBuilder.DropColumn(
                name: "ManagementTokenHash",
                table: "Signups");

            migrationBuilder.DropColumn(
                name: "Status",
                table: "Signups");
        }
    }
}
